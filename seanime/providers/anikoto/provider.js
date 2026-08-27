// AniKoto Online Streaming Provider for Seanime (anikoto.cz)

const SITE = 'https://anikoto.cz';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function _cleanTitle(og) {
  let t = String(og || '');
  t = t.replace(/\s*[|-]\s*Anikoto.*$/i, '');
  t = t.replace(/^Watch\s+/i, '').replace(/^Anime\s+/i, '');
  t = t.replace(/\s+Anime\s+Online.*$/i, '');
  t = t.replace(/\s+Watch\s+Online.*$/i, '');
  t = t.replace(/\s+Online\s+(with|free)\b.*$/i, '');
  return t.trim();
}

async function _get(url, ref, xhr = false) {
  const h = { 'User-Agent': UA, 'Referer': ref || SITE + '/' };
  if (xhr) h['X-Requested-With'] = 'XMLHttpRequest';
  try {
    const res = await fetch(url, { headers: h });
    return await res.text();
  } catch (e) {
    return '';
  }
}

async function _ajax(path) {
  try {
    const text = await _get(SITE + path, SITE + '/', true);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function _parseServers(html) {
  const servers = [];
  const re = /data-type="(\w+)"([\s\S]*?)(?=data-type="|$)/g;
  let tm;
  while ((tm = re.exec(html)) !== null) {
    const type = tm[1];
    const block = tm[2];
    const lre = /data-link-id="([^"]+)"[^>]*>([^<]*)</g;
    let lm;
    while ((lm = lre.exec(block)) !== null) {
      servers.push({ type: type, linkId: lm[1], name: (lm[2] || '').trim() });
    }
  }
  return servers;
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

    const url = `${SITE}/filter?keyword=${encodeURIComponent(q.trim())}`;
    const html = await _get(url, SITE + '/');
    const out = [];
    const seen = {};

    const items = html.match(/<div class="[^"]*film-poster[^"]*"[\s\S]*?<h3 class="[^"]*film-name[^"]*"[\s\S]*?<\/h3>/gi) || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const linkMatch = it.match(/href="\/watch\/([^"?#]+)"/i);
      if (!linkMatch) continue;
      const slug = linkMatch[1];
      if (seen[slug]) continue;
      seen[slug] = 1;

      const titleMatch = it.match(/<a[^>]+title="([^"]+)"/i) || it.match(/>([^<]+)<\/a>/i);
      const title = _cleanTitle(titleMatch ? titleMatch[1] : slug);

      out.push({
        id: slug,
        title: title,
        url: `${SITE}/watch/${slug}`,
        subOrDub: 'both'
      });
    }

    return out;
  }

  async findEpisodes(id) {
    const slug = String(id).replace(/^https?:\/\/[^/]+\/watch\//i, '').replace(/#.*$/, '').replace(/\?.*$/, '');
    const html = await _get(`${SITE}/watch/${encodeURIComponent(slug)}`, SITE + '/');
    const animeId = (html.match(/data-id="(\d+)"/) || [])[1];
    if (!animeId) return [];

    const j = await _ajax('/ajax/episode/list/' + animeId);
    const lhtml = (j && typeof j.result === 'string') ? j.result : '';
    const out = [];
    const re = /<a\b([^>]*\bdata-id="\d+"[^>]*)>/g;
    let m;

    while ((m = re.exec(lhtml)) !== null) {
      const attrs = m[1];
      const serverIds = (attrs.match(/data-ids="([^"]+)"/) || [])[1];
      if (!serverIds) continue;
      const num = parseInt((attrs.match(/data-num="(\d+)"/) || [])[1] || '0', 10);
      const title = (attrs.match(/title="([^"]+)"/) || [])[1] || `Episode ${num}`;

      out.push({
        id: JSON.stringify({ slug, num, serverIds }),
        number: num,
        title: _cleanTitle(title),
        url: `${SITE}/watch/${slug}`
      });
    }

    out.sort((a, b) => a.number - b.number);
    return out;
  }

  async findEpisodeServer(episode, server) {
    let epData;
    try {
      epData = JSON.parse(episode.id);
    } catch (e) {
      throw new Error('AniKoto: invalid episode payload');
    }

    const serverIds = epData.serverIds;
    if (!serverIds) throw new Error('AniKoto: no server ids found');

    const j = await _ajax('/ajax/server/list?servers=' + encodeURIComponent(serverIds));
    const lhtml = (j && typeof j.result === 'string') ? j.result : '';
    const servers = _parseServers(lhtml);
    if (!servers.length) throw new Error('AniKoto: no servers available');

    for (let i = 0; i < servers.length; i++) {
      const srv = servers[i];
      try {
        const sRes = await _ajax('/ajax/server?get=' + encodeURIComponent(srv.linkId));
        const res = (sRes && sRes.result) || {};
        const embedUrl = res.url;
        if (!embedUrl) continue;

        const embedHtml = await _get(embedUrl, SITE + '/');
        const dataId = (embedHtml.match(/data-id="(\d+)"/i) || [])[1];
        if (!dataId) continue;

        const base = (embedUrl.match(/^(https?:\/\/[^/]+)/) || [])[1] || 'https://megaplay.buzz';
        const streamRes = await fetch(base + '/stream/getSources?id=' + dataId, {
          headers: { 'User-Agent': UA, 'Referer': embedUrl, 'X-Requested-With': 'XMLHttpRequest' }
        });
        const streamJson = await streamRes.json();
        const s = streamJson && streamJson.sources;
        const file = s ? (s.file || (s[0] && s[0].file)) : null;
        if (!file) continue;

        const subs = [];
        const tracks = (streamJson && streamJson.tracks) || [];
        for (let t = 0; t < tracks.length; t++) {
          const track = tracks[t];
          if (!track || !track.file) continue;
          if (track.kind && track.kind !== 'captions' && track.kind !== 'subtitles') continue;
          subs.push({
            id: String(t),
            url: track.file,
            language: track.label || 'Sub',
            isDefault: !!track.default
          });
        }

        return {
          server: server || 'default',
          headers: {
            'User-Agent': UA,
            'Referer': base + '/'
          },
          videoSources: [
            {
              url: file,
              type: /\.m3u8(\?|$)/i.test(file) ? 'm3u8' : 'mp4',
              quality: 'auto',
              subtitles: subs
            }
          ]
        };
      } catch (err) {}
    }

    throw new Error('AniKoto: no playable stream found');
  }
}
