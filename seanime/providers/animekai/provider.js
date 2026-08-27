// AnimeKai Online Streaming Provider for Seanime (anikai.cc)

const BASE = 'https://www3.anikai.cc';
const EMBED_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0';

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _attr(tag, name) {
  const m = String(tag || '').match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i'));
  return m ? m[1] : '';
}

function _slugFromHref(href) {
  href = String(href || '').split('#')[0].split('?')[0];
  href = href.replace(/^https?:\/\/[^/]+/i, '');
  const m = href.match(/\/watch\/([a-z0-9][a-z0-9-]*)/i);
  if (m) return 'watch/' + m[1];
  return href.replace(/^\//, '').replace(/\/$/, '');
}

async function _kai(url, opts = {}) {
  const headers = {
    'Referer': opts.referer || (BASE + '/'),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };
  if (opts.xhr) headers['X-Requested-With'] = 'XMLHttpRequest';
  try {
    const res = await fetch(url, { method: 'GET', headers });
    return await res.text();
  } catch (e) {
    return '';
  }
}

async function _get(url, ref) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': EMBED_UA, 'Referer': ref || (BASE + '/') }
    });
    return await res.text();
  } catch (e) {
    return '';
  }
}

function _card(block) {
  const poster = block.match(/<a[^>]+class="[^"]*\bposter\b[^"]*"[^>]*href="([^"]+)"/i)
    || block.match(/href="([^"]+)"[^>]*class="[^"]*\bposter\b/i);
  let href = poster ? poster[1] : '';
  if (!href) {
    const any = block.match(/href="(\/watch\/[^"]+)"/i);
    href = any ? any[1] : '';
  }
  const slug = _slugFromHref(href);
  if (!slug || slug.indexOf('watch/') !== 0) return null;

  const titleTag = (block.match(/<a[^>]+class="[^"]*\btitle\b[^"]*"[^>]*>/i) || [])[0] || '';
  let title = _attr(titleTag, 'data-en') || _attr(titleTag, 'title') || '';
  if (!title) {
    const inner = block.match(/<a[^>]+class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    title = inner ? _cleanTitle(inner[1]) : '';
  }
  if (!title) {
    const img = block.match(/<img[^>]+alt="([^"]+)"/i);
    title = img ? img[1] : 'Untitled';
  }

  const sub = parseInt((block.match(/class="sub"[\s\S]{0,120}?(\d+)\s*<\/span>/i) || [])[1] || '0', 10) || 0;
  const dub = parseInt((block.match(/class="dub"[\s\S]{0,120}?(\d+)\s*<\/span>/i) || [])[1] || '0', 10) || 0;

  let subOrDub = 'sub';
  if (sub > 0 && dub > 0) subOrDub = 'both';
  else if (dub > 0) subOrDub = 'dub';

  return {
    id: slug,
    title: _cleanTitle(title),
    url: `${BASE}/${slug}`,
    subOrDub: subOrDub
  };
}

function _cards(html) {
  const out = [];
  const seen = {};
  const parts = String(html || '').split(/<div[^>]*class="[^"]*\baitem\b/i);
  for (let i = 1; i < parts.length; i++) {
    const c = _card('<div class="aitem' + parts[i].slice(0, 2600));
    if (c && !seen[c.id]) {
      seen[c.id] = 1;
      out.push(c);
    }
  }
  return out;
}

function _parseServers(html) {
  const out = [];
  if (typeof html !== 'string') return out;
  const groupRe = /<[a-z0-9]+[^>]*\bclass="[^"]*\bserver-items\b[^"]*"[^>]*\bdata-id="([^"]+)"[^>]*>/gi;
  const groups = [];
  let g;
  while ((g = groupRe.exec(html)) !== null) {
    groups.push({ lang: g[1].toLowerCase(), start: g.index + g[0].length });
  }
  for (let i = 0; i < groups.length; i++) {
    const cur = groups[i];
    const end = (i + 1 < groups.length) ? groups[i + 1].start : html.length;
    const inner = html.slice(cur.start, end);
    const srvRe = /<(?:span|div|li|a)\b([^>]*\bdata-video="([^"]+)"[^>]*)>([\s\S]*?)<\/(?:span|div|li|a)>/gi;
    let s;
    while ((s = srvRe.exec(inner)) !== null) {
      const attrs = s[1];
      const videoUrl = s[2];
      if (!/\bserver(?:-video)?\b/.test(attrs)) continue;
      const name = _cleanTitle(s[3]) || 'Server';
      out.push({ lang: cur.lang, name: name, videoUrl: videoUrl });
    }
  }
  return out;
}

function _embedSubtitles(embed) {
  const m = embed.match(/[?&](?:sub|caption_1|c1_file|sub_file|subtitle)=([^&]+)/i);
  if (!m) return [];
  let u = m[1];
  try { u = decodeURIComponent(u); } catch (e) {}
  if (!/^https?:\/\//i.test(u)) return [];
  let label = (embed.match(/[?&](?:sub_1|c1_label|caption_label)=([^&]+)/i) || [])[1] || 'English';
  try { label = decodeURIComponent(label); } catch (e) {}
  return [{
    id: '0',
    url: u,
    language: label,
    isDefault: true
  }];
}

class Provider {
  getSettings() {
    return {
      episodeServers: ["default"],
      supportsDub: true
    };
  }

  async search(opts) {
    const q = opts.query || (opts.media && (opts.media.englishTitle || opts.media.romajiTitle)) || '';
    if (!q || !q.trim()) return [];

    const kw = encodeURIComponent(q.trim()).replace(/%20/g, '+');
    const url = BASE + '/browser?keyword=' + kw;
    const html = await _kai(url);
    return _cards(html);
  }

  async findEpisodes(id) {
    let slug = _slugFromHref(String(id));
    if (slug.indexOf('watch/') !== 0) slug = 'watch/' + slug.replace(/^\//, '');

    const watchUrl = BASE + '/' + slug;
    const html = await _kai(watchUrl);
    if (!html) return [];

    const eps = [];
    const re = /<a\b([^>]*\bhref="\/watch\/[^"]*\/ep-[0-9.]+"[^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const tag = '<a ' + m[1] + '>';
      const inner = m[2] || '';
      const href = _attr(tag, 'href');
      const numStr = _attr(tag, 'data-num');
      let num = parseFloat(numStr);
      if (!num && num !== 0) {
        const hm = href.match(/\/ep-([0-9.]+)/i);
        num = hm ? parseFloat(hm[1]) : NaN;
      }
      if (isNaN(num)) continue;

      let t = (inner.match(/data-jp="([^"]*)"/i) || [])[1] || '';
      if (!t) t = _cleanTitle(inner.replace(/^\s*\d+\s*/, ''));
      t = _cleanTitle(t).replace(/^\d+\s+/, '');
      if (/^\s*$/.test(t) || t === String(num) || /^episode\s*\d+$/i.test(t)) t = '';

      eps.push({
        id: JSON.stringify({ slug, num }),
        number: num,
        title: t || `Episode ${num}`,
        url: `${BASE}/${slug}/ep-${num}`
      });
    }

    const seen = {};
    const uniq = [];
    for (let i = 0; i < eps.length; i++) {
      if (seen[eps[i].number]) continue;
      seen[eps[i].number] = 1;
      uniq.push(eps[i]);
    }
    uniq.sort((a, b) => a.number - b.number);
    return uniq;
  }

  async findEpisodeServer(episode, server) {
    let epData;
    try {
      epData = JSON.parse(episode.id);
    } catch (e) {
      const hm = String(episode.url || '').match(/\/ep-([0-9.]+)/i);
      const num = hm ? parseFloat(hm[1]) : 1;
      const slug = _slugFromHref(episode.url || episode.id);
      epData = { slug, num };
    }

    const epPageUrl = `${BASE}/${epData.slug}/ep-${epData.num}`;
    const html = await _kai(epPageUrl, { referer: `${BASE}/${epData.slug}` });
    if (!html) throw new Error('AnimeKai: empty episode page');

    const servers = _parseServers(html);
    if (!servers.length) throw new Error('AnimeKai: no servers on episode page');

    for (let i = 0; i < servers.length; i++) {
      const srv = servers[i];
      let embed = srv.videoUrl;
      if (/anikai\.(?:to|cc)\/iframe\//i.test(embed)) {
        const h = await _kai(embed);
        const nested = (h.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
        if (nested) embed = nested;
      }

      const subs = _embedSubtitles(embed);
      const origin = (embed.match(/^(https?:\/\/[^/]+)/i) || [])[1] || BASE;
      const embedHtml = await _get(embed, BASE + '/');

      const file = (embedHtml.match(/const\s+src\s*=\s*"([^"]+\.m3u8[^"]*)"/i)
        || embedHtml.match(/(?:"file"|file)\s*:\s*"([^"]+\.m3u8[^"]*)"/i)
        || embedHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) || [])[1];

      if (file) {
        return {
          server: server || 'default',
          headers: {
            'User-Agent': EMBED_UA,
            'Referer': origin + '/'
          },
          videoSources: [
            {
              url: file,
              type: 'm3u8',
              quality: 'auto',
              subtitles: subs
            }
          ]
        };
      }
    }

    throw new Error('AnimeKai: no playable source found');
  }
}
