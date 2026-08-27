// YLnime Online Streaming Provider for Seanime (ylnime.com)

const SITE = 'https://ylnime.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*(Subtitle Indonesia|Sub Indo)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _ensureAbsolute(u) {
  if (!u) return '';
  if (u.indexOf('http://') === 0 || u.indexOf('https://') === 0) return u;
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (u.indexOf('/') === 0) return SITE + u;
  if (u.indexOf('?') === 0) return SITE + '/index.php' + u;
  return SITE + '/' + u;
}

async function _get(url, ref) {
  const h = { 'User-Agent': UA, 'Referer': ref || SITE + '/index.php' };
  try {
    const res = await fetch(url, { headers: h });
    return await res.text();
  } catch (e) {
    return '';
  }
}

function _parseCardsFromHtml(html) {
  const out = [];
  const seen = {};

  // Method 1: Chunk split on series link
  const chunks = html.split(/href="([^"]*series=[^"]+)"/i);
  for (let i = 1; i < chunks.length; i += 2) {
    const rawLink = chunks[i];
    const after = chunks[i + 1] || '';
    const fullUrl = _ensureAbsolute(rawLink);
    if (seen[fullUrl]) continue;
    seen[fullUrl] = 1;

    const titleMatch = after.match(/<h6[^>]*class="[^"]*card-title[^"]*"[^>]*>([^<]+)<\/h6>/i)
      || after.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
    const title = _cleanTitle(titleMatch ? titleMatch[1] : '');
    if (!title || title.toLowerCase() === 'advertisement') continue;

    out.push({
      id: fullUrl,
      title: title,
      url: fullUrl,
      subOrDub: 'sub'
    });
  }

  return out;
}

class Provider {
  getSettings() {
    return {
      episodeServers: ["default"],
      supportsDub: false
    };
  }

  async search(opts) {
    const queries = [];
    if (opts.query && opts.query.trim()) queries.push(opts.query.trim());
    if (opts.media) {
      if (opts.media.romajiTitle && !queries.includes(opts.media.romajiTitle.trim())) {
        queries.push(opts.media.romajiTitle.trim());
      }
      if (opts.media.englishTitle && !queries.includes(opts.media.englishTitle.trim())) {
        queries.push(opts.media.englishTitle.trim());
      }
      if (Array.isArray(opts.media.synonyms)) {
        for (let s of opts.media.synonyms) {
          if (s && !queries.includes(s.trim())) queries.push(s.trim());
        }
      }
    }

    const allResults = [];
    const seenUrls = {};

    for (let q of queries) {
      const url = SITE + '/index.php?search=' + encodeURIComponent(q);
      const html = await _get(url, SITE + '/index.php');
      let cards = _parseCardsFromHtml(html);

      // If no exact match and query has punctuation/colon, try simplified first part
      if (cards.length === 0 && (q.includes(':') || q.includes('-') || q.includes(' '))) {
        const simplified = q.split(/[:\-–—]/)[0].trim();
        if (simplified.length > 2 && simplified !== q) {
          const sUrl = SITE + '/index.php?search=' + encodeURIComponent(simplified);
          const sHtml = await _get(sUrl, SITE + '/index.php');
          cards = _parseCardsFromHtml(sHtml);
        }
      }

      for (let c of cards) {
        if (!seenUrls[c.url]) {
          seenUrls[c.url] = 1;
          allResults.push(c);
        }
      }

      if (allResults.length > 0) break;
    }

    return allResults;
  }

  async findEpisodes(id) {
    const fullUrl = _ensureAbsolute(id);
    const html = await _get(fullUrl, SITE + '/index.php');
    const episodes = [];
    const seen = {};

    const chunks = html.split(/href="([^"]*(?:episode=|view=)[^"]*)"/i);
    for (let i = 1; i < chunks.length; i += 2) {
      const rawLink = chunks[i];
      const after = chunks[i + 1] || '';
      const epUrl = _ensureAbsolute(rawLink);
      if (seen[epUrl]) continue;
      seen[epUrl] = 1;

      const labelMatch = after.match(/<span[^>]*class="[^"]*fw-medium[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
        || after.match(/Episode\s+(\d+)/i)
        || [null, 'Episode ' + (episodes.length + 1)];
      const epLabel = _cleanTitle(labelMatch[1] || labelMatch[0]);
      const numMatch = epLabel.match(/Episode\s+(\d+)/i) || epLabel.match(/(\d+)/);
      const num = numMatch ? parseInt(numMatch[1], 10) : (episodes.length + 1);

      episodes.push({
        id: epUrl,
        number: num,
        title: epLabel || `Episode ${num}`,
        url: epUrl
      });
    }

    episodes.sort((a, b) => a.number - b.number);
    return episodes;
  }

  async findEpisodeServer(episode, server) {
    const fullUrl = _ensureAbsolute(episode.url || episode.id);
    const html = await _get(fullUrl, SITE + '/index.php');
    if (!html) throw new Error('YLnime: episode page not found');

    const streamsMatch = html.match(/const\s+streams\s*=\s*(\[[^\]]+\]);/i)
      || html.match(/streams\s*=\s*(\[[^\]]+\]);/i)
      || html.match(/(\[\s*\{[\s\S]*?"link"[\s\S]*?\}\s*\])/i);

    const sources = [];
    const seen = {};

    if (streamsMatch) {
      try {
        const rawList = JSON.parse(streamsMatch[1]);
        for (let i = 0; i < rawList.length; i++) {
          const s = rawList[i];
          if (!s || !s.link) continue;
          const streamUrl = s.link.replace(/\\/g, '').trim();
          if (seen[streamUrl]) continue;
          seen[streamUrl] = 1;

          const isHls = /\.m3u8(\?|$)/i.test(streamUrl);
          const q = s.reso || '720p';

          sources.push({
            url: streamUrl,
            type: isHls ? 'm3u8' : 'mp4',
            quality: q,
            subtitles: []
          });
        }
      } catch (e) {}
    }

    // Fallback: direct iframe in page
    if (sources.length === 0) {
      const ifr = (html.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
      if (ifr) {
        const isHls = /\.m3u8(\?|$)/i.test(ifr);
        sources.push({
          url: ifr,
          type: isHls ? 'm3u8' : 'mp4',
          quality: '720p',
          subtitles: []
        });
      }
    }

    if (!sources.length) throw new Error('YLnime: no playable streams found');

    return {
      server: server || 'default',
      headers: {
        'User-Agent': UA,
        'Referer': SITE + '/'
      },
      videoSources: sources
    };
  }
}
