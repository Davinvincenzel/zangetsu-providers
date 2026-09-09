// Oppadrama — Asian Drama, Movies & Variety Show Provider for Zangetsu (http://45.11.57.188)

var SOURCE_ID = (typeof __SOURCE_ID !== 'undefined' && __SOURCE_ID)
  ? String(__SOURCE_ID) : 'oppadrama';

var SITE = 'http://45.11.57.188';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';
var COOKIE = 'user_is_human=true';

function getInfo() {
  return {
    name: 'Oppadrama',
    lang: 'id',
    baseUrl: SITE,
    logo: 'http://i3.wp.com/45.11.57.188/wp-content/uploads/2021/05/Oppadrama.png',
    type: 'movie',
    version: '1.0.4'
  };
}

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/\s*(Subtitle Indonesia|Sub Indo)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _b64Decode(b64) {
  try {
    if (typeof atob === 'function') return atob(b64);
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
  } catch (e) {}
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var str = String(b64).replace(/[=]+$/, '');
  var out = '';
  for (var bc = 0, bs = 0, buffer = 0, idx = 0; idx < str.length; idx++) {
    buffer = (buffer << 6) | chars.indexOf(str.charAt(idx));
    if (++bc % 4) {
      bs = (buffer << (8 - (bc % 4) * 2)) & 0xff;
      out += String.fromCharCode(bs);
    }
  }
  return out;
}

function _unpack(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

function _get(url, ref, timeoutMs) {
  var h = {
    'User-Agent': UA,
    'Referer': ref || SITE + '/'
  };
  if (url.indexOf('45.11.57.188') > -1) {
    h['Cookie'] = COOKIE;
  }
  var ms = timeoutMs || 5000;
  var fetchPromise = fetch(url, { headers: h })
    .then(function (r) {
      if (!r) return '';
      if (typeof r === 'string') return r;
      if (typeof r.body === 'string') return r.body;
      if (typeof r.text === 'function') return r.text();
      return '';
    })
    .catch(function () { return ''; });

  return new Promise(function (resolve) {
    var timer = setTimeout(function () {
      resolve('');
    }, ms);
    fetchPromise.then(function (res) {
      clearTimeout(timer);
      resolve(res);
    }, function () {
      clearTimeout(timer);
      resolve('');
    });
  });
}

// Quality scoring for sorting: 1080p > 720p > 480p > 360p > Auto > default
function _qualityScore(q) {
  if (!q) return 0;
  var n = parseInt(q, 10);
  if (n >= 1080) return 5;
  if (n >= 720) return 4;
  if (n >= 480) return 3;
  if (n >= 360) return 2;
  if (/auto/i.test(q)) return 1;
  return 0;
}

// ── Search ───────────────────────────────────────────────────────────────────
function search(query, page, opts) {
  var q = String(query || '').trim();
  if (!q) return Promise.resolve([]);
  var p = parseInt(page, 10) || 1;
  var url = SITE + '/?s=' + encodeURIComponent(q);
  if (p > 1) {
    url = SITE + '/page/' + p + '/?s=' + encodeURIComponent(q);
  }

  return _get(url, SITE + '/', 6000).then(function (html) {
    var out = [];
    var seen = {};
    var articles = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];

    for (var i = 0; i < articles.length; i++) {
      var item = articles[i];
      var linkMatch = item.match(/href=["']([^"']+)["']/i);
      if (!linkMatch) continue;
      var itemUrl = linkMatch[1];
      if (seen[itemUrl]) continue;
      seen[itemUrl] = 1;

      var titleMatch = item.match(/<h2[^>]*itemprop=["']headline["'][^>]*>([\s\S]*?)<\/h2>/i)
        || item.match(/title=["']([^"']+)["']/i);
      var title = _cleanTitle(titleMatch ? titleMatch[1] : '');
      if (!title) continue;

      var imgMatch = item.match(/src=["']([^"']+)["']/i);
      var cover = imgMatch ? imgMatch[1] : null;

      var typeMatch = item.match(/class=["']typez\s+([^"']+)["']/i);
      var mediaType = 'movie';
      if (typeMatch && /series|drama|tv/i.test(typeMatch[1])) {
        mediaType = 'movie';
      }

      out.push({
        id: itemUrl,
        title: title,
        url: itemUrl,
        cover: cover,
        type: mediaType,
        sourceId: SOURCE_ID
      });
    }
    return out;
  }).catch(function () { return []; });
}

// ── Home ─────────────────────────────────────────────────────────────────────
function getHome(opts) {
  var sections = [
    { title: 'Update Terbaru', url: SITE + '/' },
    { title: 'Drama Ongoing', url: SITE + '/series/?status=ongoing&type=&order=update' },
    { title: 'Drama Completed', url: SITE + '/series/?status=completed&type=&order=update' },
    { title: 'Movie Terbaru', url: SITE + '/series/?status=&type=movie&order=update' }
  ];

  var tasks = sections.map(function (sec) {
    return _get(sec.url, SITE + '/', 6000).then(function (html) {
      var out = [];
      var seen = {};
      var articles = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];

      for (var i = 0; i < articles.length; i++) {
        var item = articles[i];
        var linkMatch = item.match(/href=["']([^"']+)["']/i);
        if (!linkMatch) continue;
        var itemUrl = linkMatch[1];
        if (seen[itemUrl]) continue;
        seen[itemUrl] = 1;

        var titleMatch = item.match(/<h2[^>]*itemprop=["']headline["'][^>]*>([\s\S]*?)<\/h2>/i)
          || item.match(/title=["']([^"']+)["']/i);
        var title = _cleanTitle(titleMatch ? titleMatch[1] : '');
        if (!title) continue;

        var imgMatch = item.match(/src=["']([^"']+)["']/i);
        var cover = imgMatch ? imgMatch[1] : null;

        out.push({
          id: itemUrl,
          title: title,
          url: itemUrl,
          cover: cover,
          type: 'movie',
          sourceId: SOURCE_ID
        });
      }
      return { title: sec.title, items: out.slice(0, 24) };
    }).catch(function () {
      return { title: sec.title, items: [] };
    });
  });

  return Promise.all(tasks).then(function (res) {
    var valid = [];
    for (var i = 0; i < res.length; i++) {
      if (res[i].items && res[i].items.length > 0) valid.push(res[i]);
    }
    return valid;
  });
}

// ── Detail & Episodes ────────────────────────────────────────────────────────
function _extractEpisodes(html, currentUrl) {
  var episodes = [];

  // Case 1: <div class="eplister"> (Series overview / some movies)
  var idx = html.indexOf('class="eplister"');
  if (idx > -1) {
    var ulMatch = html.slice(idx).match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (ulMatch) {
      var lis = ulMatch[1].match(/<li[\s\S]*?<\/li>/gi) || [];
      for (var i = 0; i < lis.length; i++) {
        var li = lis[i];
        var href = (li.match(/href=["']([^"']+)["']/i) || [])[1];
        if (!href) continue;
        var epTitle = (li.match(/class=["']epl-title["']>([^<]+)<\/div>/i) || [])[1] || '';
        var numStr = (li.match(/class=["']epl-num["']>([^<]+)<\/div>/i) || [])[1] || '';
        var numMatch = numStr.match(/^(\d+)$/) || epTitle.match(/Episode\s+(\d+)/i);
        var epNum = numMatch ? parseInt(numMatch[1], 10) : (i + 1);

        episodes.push({
          id: href,
          title: _cleanTitle(epTitle || ('Episode ' + epNum)),
          number: epNum,
          url: href,
          season: 1
        });
      }
    }
  }

  // Case 2: <div class="episodelist"> (Episode watch pages)
  if (!episodes.length) {
    var epIdx = html.indexOf('class="episodelist"');
    if (epIdx > -1) {
      var epUl = html.slice(epIdx).match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
      if (epUl) {
        var epLis = epUl[1].match(/<li[\s\S]*?<\/li>/gi) || [];
        for (var j = 0; j < epLis.length; j++) {
          var eli = epLis[j];
          var ehref = (eli.match(/href=["']([^"']+)["']/i) || [])[1];
          if (!ehref) continue;
          var h4Match = (eli.match(/<h4>([^<]+)<\/h4>/i) || [])[1] || '';
          var spanMatch = (eli.match(/<span>([^<]+)<\/span>/i) || [])[1] || '';
          var numM = spanMatch.match(/Eps?\s*(\d+)/i) || h4Match.match(/Episode\s+(\d+)/i);
          var numVal = numM ? parseInt(numM[1], 10) : (epLis.length - j);

          episodes.push({
            id: ehref,
            title: _cleanTitle(h4Match || ('Episode ' + numVal)),
            number: numVal,
            url: ehref,
            season: 1
          });
        }
      }
    }
  }

  // Case 3: Player exists directly on single post / movie
  if (!episodes.length) {
    var hasPlayer = /class=["']mirror["']/i.test(html) || /class=["']player-embed["']/i.test(html) || /<iframe/i.test(html);
    if (hasPlayer) {
      var singleTitle = _cleanTitle((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || 'Watch');
      episodes.push({
        id: currentUrl,
        title: singleTitle,
        number: 1,
        url: currentUrl,
        season: 1
      });
    }
  }

  episodes.sort(function (a, b) { return a.number - b.number; });
  return episodes;
}

// ── Detail & Episodes ────────────────────────────────────────────────────────
function getDetail(url, opts) {
  var aurl = String(url || '').trim();
  if (aurl.indexOf('http') !== 0) {
    aurl = SITE + (aurl.indexOf('/') === 0 ? aurl : '/' + aurl);
  }
  if (!/\/$/.test(aurl)) aurl += '/';

  return _get(aurl, SITE + '/', 6000).then(function (html) {
    if (!html) {
      return {
        id: aurl,
        title: 'Unknown',
        url: aurl,
        cover: null,
        description: '',
        status: 'unknown',
        genres: [],
        studios: [],
        type: 'movie',
        sourceId: SOURCE_ID,
        episodes: [],
        subCount: 0,
        dubCount: 0
      };
    }

    // If this is an episode page linking to its parent series, resolve parent series for full detail
    var parentMatch = html.match(/<h3><a href=["'](http:\/\/45\.11\.57\.188\/[^"']+)["']>([^<]+)<\/a><\/h3>/i);
    if (parentMatch && parentMatch[1] && parentMatch[1] !== aurl && !/-episode-\d+/i.test(parentMatch[1])) {
      return getDetail(parentMatch[1], opts);
    }

    var title = _cleanTitle(
      (html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) || [])[1]
      || (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]
      || ''
    );

    var poster = (html.match(/<div class=["']thumb["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) || [])[1]
      || (html.match(/<img[^>]+class=["'][^"']*ts-post-image[^"']*["'][^>]+src=["']([^"']+)["']/i) || [])[1]
      || (html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i) || [])[1]
      || null;

    var synopsis = _cleanTitle((html.match(/<div class=["']entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '');

    var statusRaw = ((html.match(/<b>Status:?<\/b>\s*([^<]+)/i) || [])[1] || '').toLowerCase();
    var status = statusRaw.indexOf('ongoing') > -1 ? 'ongoing'
      : (statusRaw.indexOf('completed') > -1 ? 'completed' : 'unknown');

    var genres = [];
    var genreBlock = (html.match(/class=["']genxed["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
    var gLinks = genreBlock.match(/<a[^>]*>([^<]+)<\/a>/gi) || [];
    for (var i = 0; i < gLinks.length; i++) {
      genres.push(_cleanTitle(gLinks[i]));
    }

    var episodes = _extractEpisodes(html, aurl);

    return {
      id: aurl,
      title: title || 'Untitled',
      englishTitle: null,
      url: aurl,
      cover: poster,
      description: synopsis,
      status: status,
      genres: genres,
      studios: [],
      type: 'movie',
      sourceId: SOURCE_ID,
      episodes: episodes,
      subCount: episodes.length,
      dubCount: 0
    };
  });
}

function getEpisodes(url, opts) {
  return getDetail(url, opts).then(function (d) {
    return (d && d.episodes) ? d.episodes : [];
  });
}

// ── Stream Extraction ────────────────────────────────────────────────────────
function _parseMasterM3u8(masterUrl, content, ref) {
  var sources = [];
  var lines = content.split(/\r?\n/);
  var currentQuality = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
      var resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
      if (resMatch) {
        currentQuality = resMatch[2] + 'p';
      } else {
        currentQuality = '720p';
      }
    } else if (line && line.indexOf('#') !== 0 && currentQuality) {
      var streamUrl = line;
      if (streamUrl.indexOf('http') !== 0) {
        var base = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
        streamUrl = base + streamUrl;
      }
      sources.push({
        url: streamUrl,
        quality: currentQuality,
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': ref || 'https://turbovidhls.com/' },
        kind: 'sub',
        audioLang: 'ko',
        label: 'TurboVIP (' + currentQuality + ')'
      });
      currentQuality = null;
    }
  }

  // Also include the master playlist as Auto
  sources.push({
    url: masterUrl,
    quality: 'Auto',
    container: 'hls',
    headers: { 'User-Agent': UA, 'Referer': ref || 'https://turbovidhls.com/' },
    kind: 'sub',
    audioLang: 'ko',
    label: 'TurboVIP (Auto)'
  });

  return sources;
}

function _extractTurboVIP(embedUrl, ref) {
  var idMatch = embedUrl.match(/\/t\/([a-zA-Z0-9]+)/i);
  var directM3u8 = idMatch ? ('https://cdn1.turboviplay.com/data3/' + idMatch[1] + '/' + idMatch[1] + '.m3u8') : null;

  var fetchUrl = embedUrl.replace(/emturbovid\.com/i, 'turbovidhls.com');

  return _get(fetchUrl, ref || SITE + '/', 6000).then(function (html) {
    var m3u8Match = html.match(/https?:\/\/[^"'\s`\\]+\.m3u8[^"'\s`\\]*/i);
    var masterUrl = m3u8Match ? m3u8Match[0] : directM3u8;
    if (!masterUrl) return [];

    return _get(masterUrl, 'https://turbovidhls.com/', 5000).then(function (playlist) {
      if (playlist && playlist.indexOf('#EXT-X-STREAM-INF:') > -1) {
        return _parseMasterM3u8(masterUrl, playlist, 'https://turbovidhls.com/');
      }
      return [{
        url: masterUrl,
        quality: '1080p',
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': 'https://turbovidhls.com/' },
        kind: 'sub',
        audioLang: 'ko',
        label: 'TurboVIP (1080p)'
      }];
    }).catch(function () {
      return [{
        url: masterUrl,
        quality: '1080p',
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': 'https://turbovidhls.com/' },
        kind: 'sub',
        audioLang: 'ko',
        label: 'TurboVIP (1080p)'
      }];
    });
  }).catch(function () {
    if (directM3u8) {
      return [{
        url: directM3u8,
        quality: '1080p',
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': 'https://turbovidhls.com/' },
        kind: 'sub',
        audioLang: 'ko',
        label: 'TurboVIP (1080p)'
      }];
    }
    return [];
  });
}

function _extractFileLions(embedUrl, ref) {
  return _get(embedUrl, ref || SITE + '/', 6000).then(function (html) {
    var pMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\}\(([\s\S]*?)\)\)\s*<\/script>/i);
    if (!pMatch) return [];

    var strMatch = pMatch[1].match(/^['"]([\s\S]*?)['"],\s*(\d+),\s*(\d+),\s*['"]([\s\S]*?)['"]\.split/);
    if (!strMatch) return [];

    var p = strMatch[1];
    var a = parseInt(strMatch[2], 10);
    var c = parseInt(strMatch[3], 10);
    var k = strMatch[4].split('|');
    var unpacked = _unpack(p, a, c, k);

    var m3u8 = unpacked.match(/https?:\/\/[^"'\s`\\]+\.m3u8[^"'\s`\\]*/i);
    if (m3u8) {
      return [{
        url: m3u8[0],
        quality: '720p',
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': embedUrl },
        kind: 'sub',
        audioLang: 'ko',
        label: 'FileLions (720p)'
      }];
    }
    return [];
  }).catch(function () { return []; });
}

function _extractFromEmbed(embedUrl, ref) {
  if (!embedUrl) return Promise.resolve([]);

  // Skip Hydrax / Abyssplayer because it uses obfuscated WASM and triggers Cloudflare hang
  if (/abyssplayer|hydrax/i.test(embedUrl)) {
    return Promise.resolve([]);
  }

  // 1. TurboVIP (emturbovid.com / turbovidhls.com / turboviplay.com)
  if (/turbovid/i.test(embedUrl)) {
    return _extractTurboVIP(embedUrl, ref);
  }

  // 2. FileLions / Minochinos
  if (/filelions|minochinos|vidhide/i.test(embedUrl)) {
    return _extractFileLions(embedUrl, ref);
  }

  // 3. Direct m3u8 or mp4 in embed HTML
  return _get(embedUrl, ref || SITE + '/', 4000).then(function (html) {
    var out = [];
    var m3u8 = html.match(/https?:\/\/[^"'\s`\\]+\.m3u8[^"'\s`\\]*/i);
    if (m3u8) {
      out.push({
        url: m3u8[0],
        quality: '720p',
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': embedUrl },
        kind: 'sub',
        audioLang: 'ko',
        label: 'Stream (720p)'
      });
      return out;
    }
    var mp4 = html.match(/<source[^>]+src=["']([^"']+\.mp4[^"']*)["']/i)
      || html.match(/file\s*:\s*["'](https?:[^"']+\.mp4[^"']*)["']/i);
    if (mp4) {
      out.push({
        url: mp4[1],
        quality: '720p',
        container: 'mp4',
        headers: { 'User-Agent': UA, 'Referer': embedUrl },
        kind: 'sub',
        audioLang: 'ko',
        label: 'Stream (720p)'
      });
    }
    return out;
  }).catch(function () { return []; });
}

function getVideoSources(episodeUrl) {
  var aurl = String(episodeUrl || '').trim();

  return _get(aurl, SITE + '/', 5000).then(function (html) {
    if (!html) return Promise.reject(new Error('Oppadrama: episode page not found'));

    // If a series overview page was passed instead of an episode page, resolve first episode
    var hasMirror = html.match(/<select[^>]*class=["']mirror["']/i) || html.match(/class=["']player-embed["']/i);
    if (!hasMirror) {
      var epList = _extractEpisodes(html, aurl);
      if (epList && epList.length > 0 && epList[0].url !== aurl) {
        return getVideoSources(epList[0].url);
      }
    }

    var mirrorSelect = html.match(/<select[^>]*class=["']mirror["'][\s\S]*?<\/select>/i);
    var mirrors = [];
    var seenEmbeds = {};

    if (mirrorSelect) {
      var options = mirrorSelect[0].match(/<option[\s\S]*?<\/option>/gi) || [];

      for (var i = 0; i < options.length; i++) {
        var opt = options[i];
        var val = (opt.match(/value=["']([^"']*)["']/i) || [])[1];
        var name = _cleanTitle(opt.replace(/<[^>]+>/g, ''));
        if (!val) continue;

        var decoded = _b64Decode(val);
        var srcMatch = decoded.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          var eUrl = srcMatch[1];
          if (!seenEmbeds[eUrl] && !/abyssplayer|hydrax/i.test(eUrl)) {
            seenEmbeds[eUrl] = 1;
            mirrors.push({ name: name, embedUrl: eUrl });
          }
        }
      }
    }

    // Also look for fallback links in download box (<div class="dlbox"> or <div class="soradl">)
    var dlEmbeds = html.match(/href=["']https?:\/\/(?:minochinos\.com|vidhidepro\.com|filelions\.[a-z]+)\/(?:v|d)\/([a-zA-Z0-9]+)["']/gi) || [];
    for (var d = 0; d < dlEmbeds.length; d++) {
      var dm = dlEmbeds[d].match(/href=["']https?:\/\/[^"']+\/(?:v|d)\/([a-zA-Z0-9]+)["']/i);
      if (dm) {
        var dlUrl = 'https://minochinos.com/v/' + dm[1];
        if (!seenEmbeds[dlUrl]) {
          seenEmbeds[dlUrl] = 1;
          mirrors.push({ name: 'FileLions', embedUrl: dlUrl });
        }
      }
    }

    if (mirrors.length > 0) {
      // Prioritize TurboVIP first (fastest Google CDN HLS multi-quality), then FileLions
      mirrors.sort(function (a, b) {
        var prio = function (n) {
          if (/turbo/i.test(n)) return 10;
          if (/filelions|minochinos|vidhide/i.test(n)) return 8;
          return 1;
        };
        return prio(b.name) - prio(a.name);
      });

      var tasks = mirrors.map(function (m) {
        return _extractFromEmbed(m.embedUrl, aurl).catch(function () { return []; });
      });

      return Promise.all(tasks).then(function (nested) {
        var flat = [];
        var seenUrls = {};
        for (var n = 0; n < nested.length; n++) {
          for (var k = 0; k < nested[n].length; k++) {
            var s = nested[n][k];
            if (!seenUrls[s.url]) {
              seenUrls[s.url] = 1;
              flat.push(s);
            }
          }
        }
        flat.sort(function (a, b) { return _qualityScore(b.quality) - _qualityScore(a.quality); });
        return flat;
      });
    }

    // Direct iframe fallback
    var ifrMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (ifrMatch && ifrMatch[1]) {
      return _extractFromEmbed(ifrMatch[1], aurl);
    }

    return [];
  }).then(function (sources) {
    if (!sources || !sources.length) {
      throw new Error('Oppadrama: no playable stream found');
    }
    return sources;
  });
}
