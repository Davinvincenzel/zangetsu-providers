// AllAnime Online Streaming Provider for Seanime (allanime.to / mkissa.to)

const API = 'https://api.mkissa.net/api';
const API_FALLBACK = 'https://api.allanime.day/api';
const REFERER = 'https://mkissa.to';
const ORIGIN = 'https://mkissa.to';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEARCH_GQL = 'query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name englishName thumbnail availableEpisodes __typename } }}';
const SHOW_GQL = 'query ($showId: String!) { show( _id: $showId ) { _id name englishName thumbnail description malId availableEpisodes availableEpisodesDetail }}';

async function _postGql(query, variables, endpoint = API) {
  const headers = { 'Referer': REFERER, 'Origin': ORIGIN, 'User-Agent': UA, 'Content-Type': 'application/json' };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ variables, query })
    });
    return await res.json();
  } catch (err) {
    if (endpoint === API && API_FALLBACK) {
      return await _postGql(query, variables, API_FALLBACK);
    }
    throw err;
  }
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
    if (opts.media.englishTitle) add(opts.media.englishTitle);
    if (opts.media.romajiTitle) add(opts.media.romajiTitle);
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
    const mode = opts.dub ? 'dub' : 'sub';
    const out = [];
    const seen = {};

    for (let q of queries) {
      const vars = {
        search: { allowAdult: false, allowUnknown: false, query: q },
        limit: 26,
        page: 1,
        translationType: mode,
        countryOrigin: 'ALL'
      };

      try {
        const j = await _postGql(SEARCH_GQL, vars);
        const edges = (j && j.data && j.data.shows && j.data.shows.edges) || [];

        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          if (!e || !e._id) continue;
          if (seen[e._id]) continue;
          seen[e._id] = 1;

          const title = _cleanTitle(e.englishName || e.name || 'Anime');
          out.push({
            id: e._id,
            title: title,
            url: `https://allanime.to/anime/${e._id}`,
            subOrDub: opts.dub ? 'dub' : 'sub'
          });
        }
      } catch (err) {}

      if (out.length > 0) break;
    }

    return out;
  }

  async findEpisodes(id) {
    const showId = String(id).replace(/^https?:\/\/[^/]+\/anime\//i, '').replace(/#.*$/, '').replace(/\?.*$/, '');
    const j = await _postGql(SHOW_GQL, { showId });
    const show = (j && j.data && j.data.show) || {};
    const aed = show.availableEpisodesDetail || {};

    const subKeys = (aed.sub || []).slice();
    const dubKeys = (aed.dub || []).slice();
    const allKeys = Array.from(new Set([...subKeys, ...dubKeys]));
    allKeys.sort((a, b) => parseFloat(a) - parseFloat(b));

    const eps = [];
    for (let i = 0; i < allKeys.length; i++) {
      const n = allKeys[i];
      const num = parseFloat(n);
      eps.push({
        id: JSON.stringify({ showId, n }),
        number: isNaN(num) ? i + 1 : num,
        title: `Episode ${n}`,
        url: `https://allanime.to/anime/${showId}/ep-${n}`
      });
    }

    return eps;
  }

  async findEpisodeServer(episode, server) {
    let showId, epNo;
    try {
      const data = JSON.parse(episode.id);
      showId = data.showId;
      epNo = String(data.n || episode.number || 1);
    } catch (e) {
      const m = String(episode.url || '').match(/anime\/([^/]+)/);
      showId = m ? m[1] : episode.id;
      epNo = String(episode.number || 1);
    }

    const showGqlRes = await _postGql(SHOW_GQL, { showId });
    const show = (showGqlRes && showGqlRes.data && showGqlRes.data.show) || {};
    const title = show.englishName || show.name || '';
    if (!title) throw new Error('AllAnime: show details not found');

    const searchQueries = [
      title.replace(/\s*Season\s*(\d+)/i, ' Season $1').replace(/[^a-zA-Z0-9 ]/g, ' ').trim(),
      show.name ? show.name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim() : null,
      title.replace(/Season\s*\d+/i, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim()
    ].filter(Boolean);

    let slug = null;
    for (let sq of searchQueries) {
      const sHtml = await fetch('https://anikoto.cz/filter?keyword=' + encodeURIComponent(sq), {
        headers: { 'User-Agent': UA }
      }).then(r => r.text()).catch(() => '');

      const slugMatch = sHtml.match(/href="https:\/\/anikoto\.cz\/watch\/([^"/?#]+)/i)
        || sHtml.match(/\/watch\/([^"/?#]+)/i);
      if (slugMatch) {
        slug = slugMatch[1].replace(/\/ep-\d+$/, '');
        break;
      }
    }

    if (!slug) throw new Error('AllAnime: stream mirror not found for ' + title);

    const watchUrl = 'https://anikoto.cz/watch/' + slug;
    const watchHtml = await fetch(watchUrl, { headers: { 'User-Agent': UA } }).then(r => r.text());
    const animeId = (watchHtml.match(/data-id="(\d+)"/) || [])[1];
    if (!animeId) throw new Error('AllAnime: mirror animeId not found');

    const epListJson = await fetch('https://anikoto.cz/ajax/episode/list/' + animeId, {
      headers: { 'User-Agent': UA, 'Referer': watchUrl, 'X-Requested-With': 'XMLHttpRequest' }
    }).then(r => r.json());
    const epHtml = (epListJson && epListJson.result) || '';

    const epMatch = epHtml.match(new RegExp(`<a[^>]+data-num=["']${epNo}["'][^>]+data-ids=["']([^"']+)["']`, 'i'))
      || epHtml.match(new RegExp(`<a[^>]+data-ids=["']([^"']+)["'][^>]+data-num=["']${epNo}["']`, 'i'))
      || epHtml.match(/data-ids="([^"]+)"/i);
    if (!epMatch) throw new Error('AllAnime: episode ' + epNo + ' not found in mirror');

    const serverIds = epMatch[1];
    const srvListJson = await fetch('https://anikoto.cz/ajax/server/list?servers=' + encodeURIComponent(serverIds), {
      headers: { 'User-Agent': UA, 'Referer': watchUrl, 'X-Requested-With': 'XMLHttpRequest' }
    }).then(r => r.json());
    const srvHtml = (srvListJson && srvListJson.result) || '';

    const linkIdMatch = srvHtml.match(/data-link-id="([^"]+)"/i);
    if (!linkIdMatch) throw new Error('AllAnime: mirror server link not found');

    const linkId = linkIdMatch[1];
    const serverJson = await fetch('https://anikoto.cz/ajax/server?get=' + encodeURIComponent(linkId), {
      headers: { 'User-Agent': UA, 'Referer': watchUrl, 'X-Requested-With': 'XMLHttpRequest' }
    }).then(r => r.json());
    const embedUrl = (serverJson && serverJson.result && serverJson.result.url) || '';
    if (!embedUrl) throw new Error('AllAnime: mirror embedUrl not found');

    const embedHtml = await fetch(embedUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://anikoto.cz/' } }).then(r => r.text());
    const dataId = (embedHtml.match(/data-id="(\d+)"/i) || [])[1];
    if (!dataId) throw new Error('AllAnime: mirror player dataId not found');

    const base = (embedUrl.match(/^(https?:\/\/[^/]+)/) || [])[1] || 'https://megaplay.buzz';
    const streamJson = await fetch(base + '/stream/getSources?id=' + dataId, {
      headers: { 'User-Agent': UA, 'Referer': embedUrl, 'X-Requested-With': 'XMLHttpRequest' }
    }).then(r => r.json());
    const s = streamJson && streamJson.sources;
    const file = s ? (s.file || (s[0] && s[0].file)) : null;
    if (!file) throw new Error('AllAnime: no stream source in mirror');

    const subs = [];
    const tracks = (streamJson && streamJson.tracks) || [];
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
  }
}
