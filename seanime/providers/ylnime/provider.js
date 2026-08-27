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

class Provider {
  getSettings() {
    return {
      episodeServers: ["default"],
      supportsDub: false
    };
  }

  async search(opts) {
    const q = opts.query || (opts.media && (opts.media.romajiTitle || opts.media.englishTitle)) || '';
    if (!q || !q.trim()) return [];

    const url = SITE + '/index.php?search=' + encodeURIComponent(q.trim());
    const html = await _get(url, SITE + '/index.php');
    const out = [];
    const seen = {};

    const cardBlocks = html.match(/<div class="[^"]*col[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || [];
    for (let i = 0; i < cardBlocks.length; i++) {
      const block = cardBlocks[i];
      const linkMatch = block.match(/href="([^"]*series=[^"]+)"/i);
      if (!linkMatch) continue;
      const fullUrl = _ensureAbsolute(linkMatch[1]);
      if (seen[fullUrl]) continue;
      seen[fullUrl] = 1;

      const titleMatch = block.match(/<h6[^>]*class="[^"]*card-title[^"]*"[^>]*>([^<]+)<\/h6>/i)
        || block.match(/alt="([^"]+)"/i);
      const title = _cleanTitle(titleMatch ? titleMatch[1] : 'Anime');
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

  async findEpisodes(id) {
    const fullUrl = _ensureAbsolute(id);
    const html = await _get(fullUrl, SITE + '/index.php');
    const episodes = [];
    const seenEp = {};

    const epTags = html.match(/<a\s+[^>]*href="[^"]*view=[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || [];
    for (let i = 0; i < epTags.length; i++) {
      const tag = epTags[i];
      const hrefMatch = tag.match(/href="([^"]*view=[^"]*)"/i);
      if (!hrefMatch) continue;
      const epUrl = _ensureAbsolute(hrefMatch[1]);
      if (seenEp[epUrl]) continue;
      seenEp[epUrl] = 1;

      const labelMatch = tag.match(/<span[^>]*class="[^"]*fw-medium[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
        || tag.match(/Episode\s+(\d+)/i)
        || [null, 'Episode ' + (episodes.length + 1)];
      const epLabel = _cleanTitle(labelMatch[1] || labelMatch[0]);
      const numMatch = epLabel.match(/Episode\s+(\d+)/i) || epLabel.match(/(\d+)/);
      const num = numMatch ? parseInt(numMatch[1], 10) : (episodes.length + 1);

      episodes.push({
        id: epUrl,
        number: num,
        title: epLabel,
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

    if (!streamsMatch) throw new Error('YLnime: no stream found on episode page');

    let rawList = [];
    try {
      rawList = JSON.parse(streamsMatch[1]);
    } catch (e) {
      throw new Error('YLnime: failed to parse stream list');
    }

    const sources = [];
    const seen = {};
    for (let i = 0; i < rawList.length; i++) {
      const s = rawList[i];
      if (!s || !s.link) continue;
      const streamUrl = s.link.replace(/\\/g, '');
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
