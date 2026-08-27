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
  return t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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
  const re = /data-link-id="([^"]+)"[^>]*>([^<]*)</g;
  let lm;
  while ((lm = re.exec(html)) !== null) {
    servers.push({ linkId: lm[1], name: (lm[2] || '').trim() });
  }
  return servers;
}

function _generateQueries(opts) {
  const queries = [];
  const add = (q) => {
    if (!q) return;
    q = String(q).trim();
    if (q && !queries.includes(q)) queries.push(q);
  };

  if (opts.query) add(opts.query);
  if (opts.media) {
    if (opts.media.romajiTitle) add(opts.media.romajiTitle);
    if (opts.media.englishTitle) add(opts.media.englishTitle);
    if (Array.isArray(opts.media.synonyms)) {
      for (let s of opts.media.synonyms) add(s);
    }
  }

  const current = queries.slice();
  for (let q of current) {
    if (/(\d+)(?:st|nd|rd|th)\s*season/i.test(q)) {
      add(q.replace(/(\d+)(?:st|nd|rd|th)\s*season/gi, 'Season $1'));
      add(q.replace(/(\d+)(?:st|nd|rd|th)\s*season/gi, '$1'));
    }
    if (/season\s*(\d+)/i.test(q)) {
      const num = q.match(/season\s*(\d+)/i)[1];
      const ord = num === '1' ? '1st' : num === '2' ? '2nd' : num === '3' ? '3rd' : (num + 'th');
      add(q.replace(/season\s*(\d+)/gi, ord + ' Season'));
    }
    const noSeason = q.replace(/(\d+(?:st|nd|rd|th)?\s*season|season\s*\d+|part\s*\d+|cour\s*\d+)/gi, '')
      .replace(/[:\-–—\s]+/g, ' ')
      .trim();
    if (noSeason && noSeason.length > 2) add(noSeason);

    if (q.includes(':')) {
      const beforeColon = q.split(':')[0].trim();
      if (beforeColon.length > 2) add(beforeColon);
    }
  }

  return queries;
}

class Provider {
  getSettings() {
    return {
      episodeServers: ["default"],
      supportsDub: true
    };
  }

  async search(opts) {
    const queries = _generateQueries(opts);
    const out = [];
    const seen = {};

    for (let q of queries) {
      const url = `${SITE}/filter?keyword=${encodeURIComponent(q)}`;
      const html = await _get(url, SITE + '/');
      const re = /<a[^>]+class="[^"]*\bname\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;

      while ((m = re.exec(html)) !== null) {
        const fullHref = m[1];
        const rawTitle = m[2];
        const slugMatch = fullHref.match(/\/watch\/([^/?#]+)/i);
        if (!slugMatch) continue;
        const slug = slugMatch[1].replace(/\/ep-\d+$/, '');
        if (seen[slug]) continue;
        seen[slug] = 1;

        const title = _cleanTitle(rawTitle);
        out.push({
          id: slug,
          title: title || slug,
          url: `${SITE}/watch/${slug}`,
          subOrDub: 'both'
        });
      }

      if (out.length > 0) break;
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
      epData = {};
    }

    let serverIds = epData.serverIds;
    const slug = epData.slug || String(episode.url || episode.id).replace(/^https?:\/\/[^/]+\/watch\//i, '').replace(/\/ep-\d+.*$/, '');
    const epNum = epData.num || episode.number || 1;

    if (!serverIds) {
      const html = await _get(`${SITE}/watch/${encodeURIComponent(slug)}`, SITE + '/');
      const animeId = (html.match(/data-id="(\d+)"/) || [])[1];
      if (animeId) {
        const j = await _ajax('/ajax/episode/list/' + animeId);
        const lhtml = (j && typeof j.result === 'string') ? j.result : '';
        const epMatch = lhtml.match(new RegExp(`<a[^>]+data-num=["']${epNum}["'][^>]+data-ids=["']([^"']+)["']`, 'i'))
          || lhtml.match(new RegExp(`<a[^>]+data-ids=["']([^"']+)["'][^>]+data-num=["']${epNum}["']`, 'i'))
          || lhtml.match(/data-ids="([^"]+)"/i);
        if (epMatch) serverIds = epMatch[1];
      }
    }

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
