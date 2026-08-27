// HiAnime Online Streaming Provider for Seanime (hianimes.se)

const API = 'https://aniwatchbackend.cfd/api';
const SITE = 'https://hianimes.se';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function _api(path) {
  try {
    const res = await fetch(API + path, { headers: { 'User-Agent': UA, 'Referer': SITE + '/' } });
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function _get(url, ref) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': ref || SITE + '/' } });
    return await res.text();
  } catch (e) {
    return '';
  }
}

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _slugOf(a) {
  if (a.slug) return a.slug;
  if (Array.isArray(a.slugs) && a.slugs.length) return a.slugs[0];
  if (typeof a.slugs === 'string') return a.slugs;
  return null;
}

async function _allEpisodes(id) {
  const e = await _api('/episodes/' + encodeURIComponent(id));
  const all = (e && e.episodes) || [];
  const total = (e && typeof e.total === 'number') ? e.total : all.length;

  const finish = () => {
    all.sort((x, y) => (x.episodeNumber || 0) - (y.episodeNumber || 0));
    return all;
  };

  async function more(depth) {
    if (all.length >= total || depth > 40) return finish();
    const start = all.length + 1;
    try {
      const e2 = await _api('/episodes/' + encodeURIComponent(id) + '?start=' + start);
      const batch = (e2 && e2.episodes) || [];
      const have = {};
      for (let i = 0; i < all.length; i++) have[all[i].episodeNumber] = 1;
      let added = 0;
      for (let k = 0; k < batch.length; k++) {
        const ep = batch[k];
        if (ep && !have[ep.episodeNumber]) {
          all.push(ep);
          added++;
        }
      }
      if (added === 0) return finish();
      return await more(depth + 1);
    } catch (err) {
      return finish();
    }
  }

  return await more(0);
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
    if (!q || q.length < 2) return [];

    try {
      const res = await fetch(API + '/search', {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Referer': SITE + '/', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: q.trim() })
      });
      const j = await res.json();
      const list = Array.isArray(j) ? j : ((j && (j.animes || j.results || j.data)) || []);
      const out = [];

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const inner = item.anime || item;
        const slug = inner && _slugOf(inner);
        if (!slug) continue;

        const title = _cleanTitle(inner.English || inner.title || inner.Japanese || slug);
        const subCount = inner.totalSub || inner.totalSubbed || 0;
        const dubCount = inner.totalDub || inner.totalDubbed || 0;

        let subOrDub = 'sub';
        if (subCount > 0 && dubCount > 0) subOrDub = 'both';
        else if (dubCount > 0) subOrDub = 'dub';

        out.push({
          id: slug,
          title: title,
          url: `${SITE}/watch/${slug}`,
          subOrDub: subOrDub
        });
      }

      return out;
    } catch (e) {
      return [];
    }
  }

  async findEpisodes(id) {
    const slug = String(id).replace(/^https?:\/\/[^/]+\/watch\//i, '').replace(/#.*$/, '').replace(/\?.*$/, '');
    const j = await _api('/anime/' + encodeURIComponent(slug));
    const a = (j && (j.anime || j)) || {};
    const animeId = a._id;
    if (!animeId) return [];

    let eps = await _allEpisodes(animeId);
    if (!eps.length && a.episodes) eps = a.episodes;

    const out = [];
    for (let i = 0; i < eps.length; i++) {
      const ep = eps[i];
      const elk = ep.link || {};
      const subP = (elk.sub || [])[0] || '';
      const dubP = (elk.dub || [])[0] || '';
      if (!subP && !dubP) continue;

      const n = ep.episodeNumber != null ? ep.episodeNumber : (i + 1);
      out.push({
        id: JSON.stringify({ slug, n, sub: subP, dub: dubP }),
        number: n,
        title: ep.title || `Episode ${n}`,
        url: `${SITE}/watch/${slug}`
      });
    }

    return out;
  }

  async findEpisodeServer(episode, server) {
    let epData;
    try {
      epData = JSON.parse(episode.id);
    } catch (e) {
      throw new Error('HiAnime: invalid episode payload');
    }

    const player = epData.sub || epData.dub;
    if (!player) throw new Error('HiAnime: no player link available');

    const html = await _get(player, SITE + '/');
    let mega = player;
    const ifr = (html.match(/<iframe[^>]+src="([^"]*megaplay[^"]*)"/i)
      || html.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
    if (ifr && ifr.indexOf('megaplay') !== -1) mega = ifr;

    const mhtml = (mega === player) ? html : await _get(mega, player);
    const dataId = (mhtml.match(/data-id="(\d+)"/i) || [])[1];
    if (!dataId) throw new Error('HiAnime: no player data-id found');

    const base = (mega.match(/^(https?:\/\/[^/]+)/) || [])[1] || 'https://megaplay.buzz';
    const streamRes = await fetch(base + '/stream/getSources?id=' + dataId, {
      headers: { 'User-Agent': UA, 'Referer': mega, 'X-Requested-With': 'XMLHttpRequest' }
    });
    const j = await streamRes.json();
    const s = j && j.sources;
    const file = s ? (s.file || (s[0] && s[0].file)) : null;
    if (!file) throw new Error('HiAnime: no stream file returned');

    const subs = [];
    const tracks = (j && j.tracks) || [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (!t || !t.file) continue;
      if (t.kind && t.kind !== 'captions' && t.kind !== 'subtitles') continue;
      subs.push({
        id: String(i),
        url: t.file,
        language: t.label || 'Sub',
        isDefault: !!t.default
      });
    }

    const videoSources = [
      {
        url: file,
        type: /\.m3u8(\?|$)/i.test(file) ? 'm3u8' : 'mp4',
        quality: 'auto',
        subtitles: subs
      }
    ];

    if (/\.m3u8(\?|$)/i.test(file)) {
      try {
        const mrText = await _get(file, base + '/');
        const dir = file.replace(/[^/]*(\?.*)?$/, '');
        const re = /#EXT-X-STREAM-INF:[^\n]*?RESOLUTION=\d+x(\d+)[^\n]*\r?\n([^\r\n#]+)/gi;
        let m;
        while ((m = re.exec(mrText)) !== null) {
          const h = m[1];
          const uri = m[2].trim();
          if (uri) {
            videoSources.push({
              url: /^https?:/i.test(uri) ? uri : (dir + uri),
              type: 'm3u8',
              quality: `${h}p`,
              subtitles: subs
            });
          }
        }
      } catch (e) {}
    }

    return {
      server: server || 'default',
      headers: {
        'User-Agent': UA,
        'Referer': base + '/'
      },
      videoSources: videoSources
    };
  }
}
