// AnimeCube Donghua Online Streaming Provider for Seanime (animecube.live)

const SITE = 'https://animecube.live';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _titleFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

async function _get(url, ref) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Referer': ref || SITE + '/' }
    });
    return await res.text();
  } catch (e) {
    return '';
  }
}

async function _json(url, ref) {
  try {
    const text = await _get(url, ref);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function _rsc(html) {
  const parts = [];
  const re = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) parts.push(m[1]);
  const s = parts.join('');
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function _field(obj, key) {
  const m = obj.match(new RegExp('"' + key + '":"((?:\\\\.|[^"\\\\])*)"'));
  return m ? m[1] : null;
}

function _cards(rsc) {
  const out = [];
  const seen = {};
  const re = /"slug":"([^"]+)","title":"((?:\\.|[^"\\])*)"[^}]*?"coverImage":"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(rsc)) !== null) {
    const slug = m[1];
    if (seen[slug]) continue;
    seen[slug] = 1;
    out.push({
      id: slug,
      title: _cleanTitle(m[2]),
      url: `${SITE}/anime/${slug}`,
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
    const q = opts.query || (opts.media && (opts.media.englishTitle || opts.media.romajiTitle)) || '';
    if (!q || !q.trim()) return [];

    const norm = q.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const sm = await _get(SITE + '/sitemap.xml', SITE + '/');
    const urls = sm.match(/<loc>[^<]*\/anime\/([^<]+)<\/loc>/gi) || [];
    const slugs = [];
    const seen = {};

    for (let i = 0; i < urls.length; i++) {
      const lm = urls[i].match(/\/anime\/([^<]+)<\/loc>/i);
      if (!lm) continue;
      const slug = lm[1].trim();
      if (seen[slug]) continue;
      seen[slug] = 1;
      const slugNorm = slug.replace(/[^a-z0-9]+/g, ' ');
      if (slugNorm.indexOf(norm) !== -1 || norm.indexOf(slugNorm) !== -1) {
        slugs.push(slug);
      }
    }

    if (slugs.length) {
      return slugs.slice(0, 25).map((slug) => ({
        id: slug,
        title: _titleFromSlug(slug),
        url: `${SITE}/anime/${slug}`,
        subOrDub: 'sub'
      }));
    }

    const html = await _get(SITE + '/', SITE + '/');
    const rsc = _rsc(html);
    const cards = _cards(rsc);
    return cards.filter((c) => c.title.toLowerCase().indexOf(norm) !== -1);
  }

  async findEpisodes(id) {
    const slug = String(id).replace(/^https?:\/\/[^/]+\/anime\//i, '').replace(/#.*$/, '');
    const html = await _get(`${SITE}/anime/${encodeURIComponent(slug)}`, SITE + '/');
    const rsc = _rsc(html);

    const seen = {};
    const eps = [];
    const re = new RegExp('"(' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-tab-(\\d+)-ep-(\\d+))"', 'g');
    let m;
    while ((m = re.exec(rsc)) !== null) {
      if (seen[m[1]]) continue;
      seen[m[1]] = 1;
      eps.push({ epSlug: m[1], tab: parseInt(m[2], 10), ep: parseInt(m[3], 10) });
    }
    eps.sort((a, b) => a.tab - b.tab || a.ep - b.ep);

    const episodes = [];
    for (let k = 0; k < eps.length; k++) {
      const n = k + 1;
      episodes.push({
        id: JSON.stringify({ slug, epSlug: eps[k].epSlug }),
        number: n,
        title: `Episode ${n}`,
        url: `${SITE}/anime/${slug}`
      });
    }

    return episodes;
  }

  async findEpisodeServer(episode, server) {
    let slug, epSlug;
    try {
      const epData = JSON.parse(episode.id);
      slug = epData.slug;
      epSlug = epData.epSlug;
    } catch (e) {
      throw new Error('AnimeCube: invalid episode id');
    }

    const tm = epSlug.match(/-tab-(\d+)-ep-(\d+)/);
    if (!tm) throw new Error('AnimeCube: bad episode slug');
    const seasonId = 'tab-' + tm[1];

    const reg = await _json(SITE + '/api/anime-sources-versions', `${SITE}/anime/${slug}`);
    const by = (reg && reg.bySeason && reg.bySeason[slug]) || {};
    let primaryId = null, token = null;
    for (const p in by) {
      if (by[p] && by[p][seasonId]) {
        primaryId = p;
        token = by[p][seasonId];
        break;
      }
    }
    if (!token) throw new Error('AnimeCube: no version token');

    const su = `${SITE}/api/anime/${slug}/episode/${epSlug}/sources?v=${encodeURIComponent(token)}&primaryTabId=${encodeURIComponent(primaryId)}&seasonId=${encodeURIComponent(seasonId)}`;
    const j = await _json(su, `${SITE}/anime/${slug}`);
    const list = (j && j.sources) || [];
    const videoSources = [];

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s) continue;
      if (s.platform === 'dailymotion' && (s.privateId || s.videoId)) {
        const privateId = s.privateId || s.videoId;
        const u = `https://geo.dailymotion.com/video/${encodeURIComponent(privateId)}.json?legacy=true&embedder=${encodeURIComponent(SITE + '/anime/' + slug)}`;
        const dmRes = await _json(u, 'https://geo.dailymotion.com/');
        const master = dmRes && dmRes.qualities && dmRes.qualities.auto && dmRes.qualities.auto[0] && dmRes.qualities.auto[0].url;
        if (master) {
          videoSources.push({
            url: master,
            type: 'm3u8',
            quality: 'auto',
            subtitles: []
          });
        }
      } else if (s.platform === 'rumble' && s.videoId) {
        const ru = `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${encodeURIComponent(s.videoId)}`;
        const rj = await _json(ru, 'https://rumble.com/');
        const uObj = rj && (rj.u || rj.ua);
        if (uObj) {
          for (const q in uObj) {
            if (uObj[q] && uObj[q].url) {
              videoSources.push({
                url: uObj[q].url,
                type: 'mp4',
                quality: `${q}p`,
                subtitles: []
              });
            }
          }
        }
      }
    }

    if (!videoSources.length) throw new Error('AnimeCube: no playable stream found');

    return {
      server: server || 'default',
      headers: {
        'User-Agent': UA,
        'Referer': `${SITE}/`
      },
      videoSources: videoSources
    };
  }
}
