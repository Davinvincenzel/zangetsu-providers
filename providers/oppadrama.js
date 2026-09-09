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
    version: '1.0.7'
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
  var b64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var str = String(b64 || '').replace(/[^A-Za-z0-9\+\/\=]/g, '');
  var output = '';
  var i = 0;
  while (i < str.length) {
    var enc1 = b64Chars.indexOf(str.charAt(i++));
    var enc2 = b64Chars.indexOf(str.charAt(i++));
    var enc3 = b64Chars.indexOf(str.charAt(i++));
    var enc4 = b64Chars.indexOf(str.charAt(i++));

    var chr1 = (enc1 << 2) | (enc2 >> 4);
    var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    var chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64 && enc4 !== -1) {
      output += String.fromCharCode(chr3);
    }
  }
  return output;
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
    'Cookie': COOKIE,
    'Referer': ref || SITE + '/'
  };
  return fetch(url, { headers: h, timeoutMs: timeoutMs || 8000 })
    .then(function (r) {
      if (!r) return '';
      if (typeof r === 'string') return r;
      if (typeof r.body === 'string') return r.body;
      if (typeof r.text === 'function') return r.text();
      return '';
    })
    .catch(function () { return ''; });
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

function _parseArticles(htmlBlock) {
  var out = [];
  var seen = {};
  var articles = htmlBlock.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];

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
  return out;
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
    return _parseArticles(html);
  }).catch(function () { return []; });
}

// ── Home ─────────────────────────────────────────────────────────────────────
function getHome(opts) {
  return _get(SITE + '/', SITE + '/', 6000).then(function (html) {
    if (!html) return [];
    var bixboxes = html.split(/<div class=["']bixbox["'][^>]*>/i);
    var out = [];

    var updateItems = _parseArticles(bixboxes[1] || html);
    if (updateItems.length > 0) {
      out.push({ title: 'Update Terbaru', items: updateItems });
    }

    if (bixboxes.length > 2) {
      var featuredItems = _parseArticles(bixboxes[2] || '');
      if (featuredItems.length > 0) {
        out.push({ title: 'Film & Drama Pilihan', items: featuredItems });
      }
    }

    return out;
  }).catch(function () { return []; });
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

    var m3u8Match = unpacked.match(/https?:\/\/[^"'\s`\\]+\.m3u8[^"'\s`\\]*/i);
    if (!m3u8Match) return [];

    var masterUrl = m3u8Match[0];

    return _get(masterUrl, embedUrl, 4000).then(function (playlist) {
      if (!playlist || playlist.indexOf('#EXT-X-STREAM-INF:') === -1) {
        return [{
          url: masterUrl,
          quality: '720p',
          container: 'hls',
          headers: { 'User-Agent': UA, 'Referer': embedUrl },
          kind: 'sub',
          audioLang: 'ko',
          label: 'FileLions (720p)'
        }];
      }

      var lines = playlist.split(/\r?\n/);
      var variants = [];
      var curRes = '720p';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;

        if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
          var resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
          if (resMatch) {
            var h = parseInt(resMatch[1], 10);
            curRes = h >= 1000 ? '1080p' : (h >= 700 ? '720p' : (h >= 460 ? '480p' : '360p'));
          }
          continue;
        }

        if (line.indexOf('#') !== 0) {
          var sUrl = line;
          if (!/^https?:\/\//i.test(sUrl)) {
            var base = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
            sUrl = base + sUrl;
          }
          variants.push({
            url: sUrl,
            quality: curRes,
            container: 'hls',
            headers: { 'User-Agent': UA, 'Referer': embedUrl },
            kind: 'sub',
            audioLang: 'ko',
            label: 'FileLions (' + curRes + ')'
          });
          curRes = '720p';
        }
      }

      if (variants.length > 0) {
        var rank = { '1080p': 4, '720p': 3, '480p': 2, '360p': 1 };
        variants.sort(function (a, b) {
          return (rank[b.quality] || 0) - (rank[a.quality] || 0);
        });
        return variants;
      }

      return [{
        url: masterUrl,
        quality: '720p',
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': embedUrl },
        kind: 'sub',
        audioLang: 'ko',
        label: 'FileLions (720p)'
      }];
    }).catch(function () {
      return [{
        url: masterUrl,
        quality: '720p',
        container: 'hls',
        headers: { 'User-Agent': UA, 'Referer': embedUrl },
        kind: 'sub',
        audioLang: 'ko',
        label: 'FileLions (720p)'
      }];
    });
  }).catch(function () { return []; });
}

function _extractFromEmbed(embedUrl, ref) {
  if (!embedUrl) return Promise.resolve([]);

  // Skip Hydrax / Abyssplayer and TurboVIP:
  // - Abyssplayer uses obfuscated WASM and triggers Cloudflare hang
  // - TurboVIP uses fake PNG headers (\x89PNG) on Google User Content which causes libmpv/ffmpeg to hang or fail
  if (/abyssplayer|hydrax|turbovid|turbosplayer/i.test(embedUrl)) {
    return Promise.resolve([]);
  }

  // 1. FileLions / Minochinos / Vidhide / Callistanise
  if (/filelions|minochinos|vidhide|callistanise/i.test(embedUrl)) {
    return _extractFileLions(embedUrl, ref);
  }

  // 2. Direct m3u8 or mp4 in embed HTML
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

    // 1. Check direct iframe on page (skip unplayable hosts)
    var pageIframes = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi) || [];
    for (var f = 0; f < pageIframes.length; f++) {
      var fsrc = (pageIframes[f].match(/src=["']([^"']+)["']/i) || [])[1];
      if (fsrc && !seenEmbeds[fsrc] && !/abyssplayer|hydrax|turbovid|turbosplayer/i.test(fsrc)) {
        seenEmbeds[fsrc] = 1;
        var fname = /filelions|minochinos|vidhide|callistanise/i.test(fsrc) ? 'FileLions' : 'Player';
        mirrors.push({ name: fname, embedUrl: fsrc });
      }
    }

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
          if (!seenEmbeds[eUrl] && !/abyssplayer|hydrax|turbovid|turbosplayer/i.test(eUrl)) {
            seenEmbeds[eUrl] = 1;
            mirrors.push({ name: name, embedUrl: eUrl });
          }
        }
      }
    }

    // Also look for fallback links in download box (<div class="dlbox"> or <div class="soradl">)
    var dlEmbeds = html.match(/href=["']https?:\/\/(?:minochinos\.com|vidhidepro\.com|callistanise\.com|filelions\.[a-z]+)\/(?:v|d)\/([a-zA-Z0-9]+)["']/gi) || [];
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
          if (/filelions|minochinos|vidhide/i.test(n)) return 5;
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
        flat.sort(function (a, b) {
          var sPrio = function (s) {
            if (/turbo/i.test(s.label || '')) return 10;
            if (/filelions/i.test(s.label || '')) return 5;
            return 1;
          };
          var pDiff = sPrio(b) - sPrio(a);
          if (pDiff !== 0) return pDiff;
          return _qualityScore(b.quality) - _qualityScore(a.quality);
        });
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
