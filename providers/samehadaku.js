// Samehadaku — Ultra-Fast Indonesian Anime Provider for Zangetsu (https://v2.samehadaku.how)

var SOURCE_ID = (typeof __SOURCE_ID !== 'undefined' && __SOURCE_ID)
  ? String(__SOURCE_ID) : 'samehadaku';

var SITE = 'https://v2.samehadaku.how';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function getInfo() {
  return {
    name: 'Samehadaku',
    lang: 'id',
    baseUrl: SITE,
    logo: SITE + '/wp-content/uploads/2024/07/logo-samehadaku-2.png',
    type: 'anime',
    version: '1.0.3'
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

function _get(url, ref, timeoutMs) {
  var h = { 'User-Agent': UA, 'Referer': ref || SITE + '/' };
  return fetch(url, { headers: h, timeoutMs: timeoutMs || 3000 })
    .then(function (r) {
      if (!r) return '';
      if (typeof r === 'string') return r;
      if (typeof r.body === 'string') return r.body;
      return '';
    })
    .catch(function () { return ''; });
}

function _post(url, data, ref, timeoutMs) {
  var h = {
    'User-Agent': UA,
    'Referer': ref || SITE + '/',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest'
  };
  var body = '';
  if (typeof data === 'string') {
    body = data;
  } else if (data && typeof data === 'object') {
    var pairs = [];
    for (var k in data) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
      }
    }
    body = pairs.join('&');
  }
  return fetch(url, { method: 'POST', headers: h, body: body, timeoutMs: timeoutMs || 3000 })
    .then(function (r) {
      if (!r) return '';
      if (typeof r === 'string') return r;
      if (typeof r.body === 'string') return r.body;
      return '';
    })
    .catch(function () { return ''; });
}

function _unpack(code) {
  try {
    var match = code.match(/eval\s*\(\s*function\s*\([^\)]*\)\s*\{[\s\S]*?\}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\s*\.split\(/i)
      || code.match(/}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\s*\.split\(/i);
    if (!match) {
      var alt = code.match(/}\s*\(\s*['"]([\s\S]+?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]+?)['"]\.split\(/);
      if (!alt) return '';
      match = alt;
    }
    var payload = match[1];
    var radix = parseInt(match[2], 10);
    var count = parseInt(match[3], 10);
    var symtab = match[4].split('|');

    var encode = function (c) {
      return (c < radix ? '' : encode(Math.floor(c / radix))) +
        ((c = c % radix) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
    };

    for (var i = count; i--; ) {
      if (symtab[i]) {
        payload = payload.replace(new RegExp('\\b' + encode(i) + '\\b', 'g'), symtab[i]);
      }
    }
    return payload;
  } catch (e) {
    return '';
  }
}

// ── Search ───────────────────────────────────────────────────────────────────
function search(query, page, opts) {
  var q = String(query || '').trim();
  if (q.length < 1) return Promise.resolve([]);
  var p = parseInt(page, 10) || 1;
  var url = p > 1
    ? SITE + '/page/' + p + '/?s=' + encodeURIComponent(q)
    : SITE + '/?s=' + encodeURIComponent(q);

  return _get(url, SITE + '/', 3000).then(function (html) {
    var out = [], seen = {};
    var articles = html.match(/<article[\s\S]*?<\/article>/gi)
      || html.match(/<div class=["']animposx["'][\s\S]*?<\/div>\s*<\/div>/gi) || [];

    for (var i = 0; i < articles.length; i++) {
      var block = articles[i];
      var linkMatch = block.match(/<a[^>]+href=["'](https?:\/\/[^"']+\/anime\/[^"']+)["'][^>]*>/i)
        || block.match(/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i);
      if (!linkMatch) continue;
      var aurl = linkMatch[1];
      if (aurl.indexOf('http') !== 0) aurl = SITE + aurl;
      if (seen[aurl]) continue;
      seen[aurl] = 1;

      var titleMatch = block.match(/<div class=["']title["']>[\s\S]*?<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)
        || block.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)
        || block.match(/title=["']([^"']+)["']/i)
        || block.match(/alt=["']([^"']+)["']/i);
      var title = _cleanTitle(titleMatch ? titleMatch[1] : '');
      if (!title) continue;

      var imgMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
      var cover = imgMatch ? imgMatch[1] : null;
      if (cover && cover.indexOf('http') !== 0) cover = SITE + cover;

      out.push({
        id: aurl,
        title: title,
        url: aurl,
        cover: cover,
        type: 'anime',
        sourceId: SOURCE_ID
      });
    }
    return out;
  }).catch(function () { return []; });
}

// ── Home ─────────────────────────────────────────────────────────────────────
function getHome(opts) {
  var sections = [
    { title: 'Anime Terbaru', url: SITE + '/anime-terbaru/' },
    { title: 'Ongoing Anime', url: SITE + '/daftar-anime-2/?status=Currently+Airing&order=popular' },
    { title: 'Completed Anime', url: SITE + '/daftar-anime-2/?status=Completed&order=popular' },
    { title: 'Anime Movie', url: SITE + '/anime-movie/' }
  ];

  var tasks = sections.map(function (sec) {
    return _get(sec.url, SITE + '/', 3000).then(function (html) {
      var out = [], seen = {};
      var listItems = html.match(/<li[^>]*itemscope[^>]*>[\s\S]*?<\/li>/gi)
        || html.match(/<article[\s\S]*?<\/article>/gi)
        || html.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];

      for (var j = 0; j < listItems.length; j++) {
        var item = listItems[j];
        var liLink = item.match(/<a[^>]+href=["'](https?:\/\/[^"']+\/anime\/[^"']+)["'][^>]*>/i)
          || item.match(/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i);
        if (!liLink) continue;
        var itemUrl = liLink[1];
        if (itemUrl.indexOf('http') !== 0) itemUrl = SITE + itemUrl;
        if (seen[itemUrl]) continue;
        seen[itemUrl] = 1;

        var liTitle = item.match(/<h2[^>]*class=["']entry-title["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
          || item.match(/<div class=["']title["']>[\s\S]*?<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)
          || item.match(/title=["']([^"']+)["']/i);
        var itTitle = _cleanTitle(liTitle ? liTitle[1] : '');
        if (!itTitle) continue;

        var liImg = item.match(/<img[^>]+src=["']([^"']+)["']/i);
        var itCover = liImg ? liImg[1] : null;
        if (itCover && itCover.indexOf('http') !== 0) itCover = SITE + itCover;

        out.push({
          id: itemUrl,
          title: itTitle,
          url: itemUrl,
          cover: itCover,
          type: 'anime',
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
function getDetail(url, opts) {
  var aurl = String(url || '').trim();
  if (aurl.indexOf('http') !== 0) {
    if (aurl.indexOf('anime/') === 0) aurl = SITE + '/' + aurl;
    else if (aurl.indexOf('/') === 0) aurl = SITE + aurl;
    else aurl = SITE + '/anime/' + aurl + '/';
  }
  if (!/\/$/.test(aurl)) aurl += '/';

  return _get(aurl, SITE + '/', 3000).then(function (html) {
    var title = _cleanTitle(
      (html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) || [])[1]
      || (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]
      || (html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i) || [])[1]
      || ''
    );
    var japanese = _cleanTitle((html.match(/<span><b>Japanese<\/b>\s*([^<]+)<\/span>/i) || [])[1] || '');
    var poster = (html.match(/<div class=["']thumb["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
      || html.match(/<img[^>]+class=["'][^"']*anmsa[^"']*["'][^>]+src=["']([^"']+)["']/i)
      || html.match(/<img[^>]+class=["'][^"']*attachment-post-thumbnail[^"']*["'][^>]+src=["']([^"']+)["']/i)
      || html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i) || [])[1] || null;
    if (poster && poster.indexOf('http') !== 0) poster = SITE + poster;

    var synopsis = _cleanTitle((html.match(/<div class=["']entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '');
    var statusRaw = ((html.match(/<b>Status<\/b>\s*([^<]+)/i) || [])[1] || '').toLowerCase();
    var status = statusRaw.indexOf('ongoing') > -1 ? 'ongoing'
      : (statusRaw.indexOf('complete') > -1 ? 'completed' : 'unknown');

    var genres = [];
    var genreBlock = (html.match(/<div class=["']genre-info["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
    var gMatch = genreBlock.match(/<a[^>]*>([^<]+)<\/a>/g) || [];
    for (var g = 0; g < gMatch.length; g++) {
      var gt = _cleanTitle(gMatch[g]);
      if (gt) genres.push(gt);
    }

    var episodes = [];
    var seen = {};

    var epLists = html.split(/class=["'][^"']*lstepsiode[^"']*["']/i);
    for (var i = 1; i < epLists.length; i++) {
      var block = epLists[i].split('</ul>')[0];
      var liItems = block.split('<li');
      for (var j = 1; j < liItems.length; j++) {
        var item = liItems[j];
        var linkMatch = item.match(/<span class=["']lchx["']><a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
          || item.match(/<div class=["']epsright["']><span class=["']eps["']><a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
          || item.match(/<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;
        var epUrl = linkMatch[1];
        if (epUrl.indexOf('http') !== 0) epUrl = SITE + epUrl;
        if (seen[epUrl]) continue;
        if (epUrl.indexOf('/anime/') > -1 || epUrl.indexOf('daftar-batch') > -1 || epUrl.indexOf('pembatas-episode') > -1) continue;
        seen[epUrl] = 1;

        var rawEpTitle = linkMatch[2];
        var epDate = _cleanTitle((item.match(/<span class=["']date["'][^>]*>([^<]+)<\/span>/i) || [])[1] || '');
        var numMatch = rawEpTitle.match(/Episode\s+(\d+)/i) || epUrl.match(/episode-(\d+)/i) || rawEpTitle.match(/(\d+)/);
        var num = numMatch ? parseInt(numMatch[1], 10) : (episodes.length + 1);

        episodes.push({
          id: epUrl,
          number: num,
          title: _cleanTitle(rawEpTitle) || ('Episode ' + num),
          url: epUrl,
          date: epDate || null
        });
      }
    }

    if (episodes.length === 0) {
      var playerLink = html.match(/<a[^>]+href=["'](https?:\/\/[^"']*(?:movie|special|episode)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (playerLink && playerLink[1] && playerLink[1].indexOf('/anime/') === -1) {
        episodes.push({
          id: playerLink[1],
          number: 1,
          title: _cleanTitle(playerLink[2]) || 'Full Movie',
          url: playerLink[1],
          date: null
        });
      }
    }

    episodes.sort(function (a, b) { return a.number - b.number; });

    return {
      id: aurl,
      title: title || 'Untitled',
      englishTitle: japanese || null,
      cover: poster,
      url: aurl,
      description: synopsis,
      status: status,
      genres: genres,
      studios: [],
      type: 'anime',
      sourceId: SOURCE_ID,
      episodes: episodes,
      subCount: episodes.length,
      dubCount: 0
    };
  });
}

function getEpisodes(url, opts) {
  return getDetail(url, opts).then(function (d) { return d.episodes; });
}

// ── Stream Extraction ────────────────────────────────────────────────────────
function _extractFromEmbed(embedUrl, ref, qualityHint) {
  if (!embedUrl) return Promise.resolve([]);
  var u = String(embedUrl).trim();
  if (u.indexOf('http') !== 0) return Promise.resolve([]);

  // Direct media URL (.mp4 / .m3u8)
  if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(u)) {
    var isHls = /\.m3u8(\?|$)/i.test(u);
    return Promise.resolve([{
      url: u,
      quality: qualityHint || '720p',
      container: isHls ? 'hls' : 'mp4',
      headers: { 'User-Agent': UA, 'Referer': ref || SITE + '/' },
      kind: 'sub',
      audioLang: 'ja'
    }]);
  }

  // Pixeldrain direct API
  if (u.indexOf('pixeldrain.com/u/') > -1) {
    var id = u.replace(/\/$/, '').split('/').pop();
    var directPd = 'https://pixeldrain.com/api/file/' + id;
    return Promise.resolve([{
      url: directPd,
      quality: qualityHint || '720p',
      container: 'mp4',
      headers: { 'User-Agent': UA, 'Referer': 'https://pixeldrain.com/' },
      kind: 'sub',
      audioLang: 'ja'
    }]);
  }

  // Wibufile embed
  if (u.indexOf('wibufile.com/embed') > -1) {
    return _get(u, ref, 3000).then(function (html) {
      var sourcesMatch = html.match(/sources\s*:\s*(\[[^\]]+\])/i)
        || html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
      if (sourcesMatch) {
        var resList = [];
        try {
          var arr = JSON.parse(sourcesMatch[1]);
          for (var k = 0; k < arr.length; k++) {
            if (arr[k].file) {
              resList.push({
                url: arr[k].file.replace(/\\/g, ''),
                quality: qualityHint || '720p',
                container: 'mp4',
                headers: { 'User-Agent': UA, 'Referer': u },
                kind: 'sub',
                audioLang: 'ja'
              });
            }
          }
        } catch (e) {
          if (sourcesMatch[1]) {
            resList.push({
              url: sourcesMatch[1].replace(/\\/g, ''),
              quality: qualityHint || '720p',
              container: 'mp4',
              headers: { 'User-Agent': UA, 'Referer': u },
              kind: 'sub',
              audioLang: 'ja'
            });
          }
        }
        return resList;
      }
      return [];
    }).catch(function () { return []; });
  }

  // Vidhide / Vidlion
  if (u.indexOf('vidhide') > -1 || u.indexOf('vidlion') > -1) {
    return _get(u, ref, 3000).then(function (html) {
      var unpacked = html;
      if (/eval\(function\(p,a,c,k,e/.test(html)) {
        unpacked = _unpack(html);
      }
      var combined = unpacked + '\n' + html;
      var m = combined.match(/(?:file|sources?|src)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i)
        || combined.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m && m[1]) {
        var baseHost = (u.match(/^(https?:\/\/[^/]+)/) || [])[1] || u;
        return [{
          url: m[1].replace(/\\/g, ''),
          quality: qualityHint || '720p',
          container: 'hls',
          headers: { 'User-Agent': UA, 'Referer': baseHost + '/' },
          kind: 'sub',
          audioLang: 'ja'
        }];
      }
      return [];
    }).catch(function () { return []; });
  }

  return Promise.resolve([]);
}

function getVideoSources(episodeUrl) {
  var fullUrl = String(episodeUrl || '').trim();
  if (fullUrl.indexOf('http') !== 0) fullUrl = SITE + '/' + fullUrl.replace(/^\/+/, '');

  return _get(fullUrl, SITE + '/', 3000).then(function (html) {
    if (!html) return Promise.reject(new Error('Samehadaku: episode page not found'));

    var serverTasks = [];

    // 1. AJAX Player options (.east_player_option)
    var regex = /<div id=["']player-option-(\d+)["'] class=["']east_player_option["'] data-post=["']([^"']+)["'] data-nume=["']([^"']+)["'] data-type=["']([^"']+)["']><span>([^<]+)<\/span>/gi;
    var m;
    while ((m = regex.exec(html)) !== null) {
      (function (post, nume, type, label) {
        var qMatch = label.match(/(360p|480p|720p|1080p|4k)/i);
        var q = qMatch ? qMatch[1].toLowerCase() : (label.indexOf('HD') > -1 ? '720p' : 'auto');

        serverTasks.push(
          _post(
            SITE + '/wp-admin/admin-ajax.php',
            { action: 'player_ajax', post: post, nume: nume, type: type },
            fullUrl,
            3000
          ).then(function (ajaxRes) {
            if (!ajaxRes) return [];
            var iframeSrc = (ajaxRes.match(/src=["']([^"']+)["']/i) || [])[1] || '';
            if (!iframeSrc) {
              var vidlionMatch = ajaxRes.match(/\[vidlion\s+id=([a-zA-Z0-9_-]+)\]/i);
              if (vidlionMatch) {
                iframeSrc = 'https://vidhidepro.com/v/' + vidlionMatch[1];
              }
            }
            if (iframeSrc) {
              return _extractFromEmbed(iframeSrc, fullUrl, q);
            }
            return [];
          }).catch(function () { return []; })
        );
      })(m[2], m[3], m[4], m[5].trim());
    }

    // 2. Pixeldrain links in downloads table
    var dlBlocks = html.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
    for (var d = 0; d < dlBlocks.length; d++) {
      var block = dlBlocks[d];
      var pdMatch = block.match(/https?:\/\/(?:www\.)?pixeldrain\.com\/u\/([a-zA-Z0-9_-]+)/i);
      if (pdMatch) {
        var qm = block.match(/(360p|480p|720p|1080p|4k)/i);
        var qHint = qm ? qm[1].toLowerCase() : '720p';
        var pdUrl = 'https://pixeldrain.com/api/file/' + pdMatch[1];
        serverTasks.push(Promise.resolve([{
          url: pdUrl,
          quality: qHint,
          container: 'mp4',
          headers: { 'User-Agent': UA, 'Referer': 'https://pixeldrain.com/' },
          kind: 'sub',
          audioLang: 'ja'
        }]));
      }
    }

    return Promise.all(serverTasks).then(function (results) {
      var all = [];
      var seen = {};
      for (var i = 0; i < results.length; i++) {
        var list = results[i] || [];
        for (var j = 0; j < list.length; j++) {
          var src = list[j];
          if (!src || !src.url || seen[src.url]) continue;
          seen[src.url] = 1;
          all.push(src);
        }
      }

      if (all.length === 0) {
        return Promise.reject(new Error('Samehadaku: no playable streams found'));
      }

      all.sort(function (a, b) {
        var aNum = parseInt(a.quality, 10) || (a.quality === '4k' ? 2160 : 0);
        var bNum = parseInt(b.quality, 10) || (b.quality === '4k' ? 2160 : 0);
        var aVal = (a.container === 'hls' ? 5 : 0) + aNum;
        var bVal = (b.container === 'hls' ? 5 : 0) + bNum;
        return bVal - aVal;
      });

      return all;
    });
  });
}
