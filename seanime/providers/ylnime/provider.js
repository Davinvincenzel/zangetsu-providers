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
  u = String(u).trim();
  u = u.replace(/^https?:\/\/ylnime\.com\/\?/, 'https://ylnime.com/index.php?');
  u = u.replace(/^https?:\/\/ylnime\.com\/(view|series)\.php/, 'https://ylnime.com/index.php');
  if (u.indexOf('http://') === 0 || u.indexOf('https://') === 0) return u;
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (u.indexOf('/?') === 0) return SITE + '/index.php' + u.slice(1);
  if (u.indexOf('?') === 0) return SITE + '/index.php' + u;
  if (u.indexOf('/') === 0) return SITE + u;
  return SITE + '/index.php?' + u;
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
    // 4th Season -> Season 4
    if (/(\d+)(?:st|nd|rd|th)\s*season/i.test(q)) {
      add(q.replace(/(\d+)(?:st|nd|rd|th)\s*season/gi, 'Season $1'));
      add(q.replace(/(\d+)(?:st|nd|rd|th)\s*season/gi, '$1'));
    }
    // Season 4 -> 4th Season
    if (/season\s*(\d+)/i.test(q)) {
      const num = q.match(/season\s*(\d+)/i)[1];
      const ord = num === '1' ? '1st' : num === '2' ? '2nd' : num === '3' ? '3rd' : (num + 'th');
      add(q.replace(/season\s*(\d+)/gi, ord + ' Season'));
    }
    // Strip season numbers to match root title
    const noSeason = q.replace(/(\d+(?:st|nd|rd|th)?\s*season|season\s*\d+|part\s*\d+|cour\s*\d+)/gi, '')
      .replace(/[:\-–—\s]+/g, ' ')
      .trim();
    if (noSeason && noSeason.length > 2) add(noSeason);

    // Strip subtitle after colon
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
      supportsDub: false
    };
  }

  async search(opts) {
    const queries = _generateQueries(opts);
    const allResults = [];
    const seenUrls = {};

    for (let q of queries) {
      const url = SITE + '/index.php?search=' + encodeURIComponent(q);
      const html = await _get(url, SITE + '/index.php');
      const cards = _parseCardsFromHtml(html);

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
