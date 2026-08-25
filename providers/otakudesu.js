// Otakudesu — Indonesian anime provider for Zangetsu (otakudesu.blog).

var SOURCE_ID = (typeof __SOURCE_ID !== 'undefined' && __SOURCE_ID)
  ? String(__SOURCE_ID) : 'otakudesu';

var SITE = 'https://otakudesu.blog';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function getInfo() {
  return {
    name: 'Otakudesu',
    lang: 'id',
    baseUrl: SITE,
    logo: SITE + '/wp-content/uploads/2017/06/Logo-1.png',
    type: 'anime',
    version: '1.0.0'
  };
}

function _get(url, ref) {
  var h = { 'User-Agent': UA, 'Referer': ref || SITE + '/' };
  return fetch(url, { headers: h })
    .then(function (r) { return r.body || ''; })
    .catch(function () { return ''; });
}

function _post(url, data, ref) {
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
  return fetch(url, { method: 'POST', headers: h, body: body })
    .then(function (r) {
      var j;
      try { j = JSON.parse(r.body || 'null'); } catch (e) { j = null; }
      return j;
    })
    .catch(function () { return null; });
}

function _cleanTitle(t) {
  return String(t || '')
    .replace(/\s*(Subtitle Indonesia|Sub Indo)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _b64Decode(str) {
  try {
    if (typeof atob === 'function') return atob(str);
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf8');
    var bytes = globalThis.base64ToBytes(str);
    var res = '';
    for (var i = 0; i < bytes.length; i++) res += String.fromCharCode(bytes[i]);
    return res;
  } catch (e) {
    return '';
  }
}

function _unpack(code) {
  try {
    var m = code.match(/}\s*\(\s*["']([\s\S]*?)["']\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*["']([\s\S]*?)["']\.split\(/);
    if (!m) return '';
    var payload = m[1];
    var radix = parseInt(m[2], 10);
    var count = parseInt(m[3], 10);
    var keywords = m[4].split('|');
    var encode = function (c) {
      return (c < radix ? '' : encode(Math.floor(c / radix))) +
        ((c = c % radix) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
    };
    for (var i = count; i--; ) {
      if (keywords[i]) {
        payload = payload.replace(new RegExp('\\b' + encode(i) + '\\b', 'g'), keywords[i]);
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
  var url = SITE + '/?s=' + encodeURIComponent(q) + '&post_type=anime';
  return _get(url, SITE + '/').then(function (html) {
    var out = [], seen = {};
    var chunks = html.split('<ul class="chivsrc">');
    if (chunks.length < 2) return [];
    var listBlock = chunks[1].split('</ul>')[0];
    var items = listBlock.split('<li');
    for (var i = 1; i < items.length; i++) {
      var c = items[i];
      var linkMatch = c.match(/<h2[^>]*><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a><\/h2>/i)
        || c.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      if (!linkMatch) continue;
      var aurl = linkMatch[1];
      if (seen[aurl]) continue;
      seen[aurl] = 1;
      var title = _cleanTitle(htmlText(linkMatch[2]));
      var img = (c.match(/<img[^>]+src="([^"]+)"/) || [])[1] || null;
      out.push({
        id: aurl,
        title: title,
        url: aurl,
        cover: img,
        type: 'anime',
        sourceId: SOURCE_ID
      });
    }
    return out;
  }).catch(function () { return []; });
}

// ── Home ─────────────────────────────────────────────────────────────────────
function getHome(opts) {
  return _get(SITE + '/', SITE + '/').then(function (html) {
    var sections = html.split(/<div class=["']venz["']>/i);
    var out = [];
    for (var i = 1; i < sections.length; i++) {
      var sec = sections[i];
      var secTitle = (i === 1) ? 'On-going Anime' : 'Complete Anime';
      var items = sec.split(/<div class=["']detpost["']>/i);
      var cards = [], seen = {};
      for (var j = 1; j < items.length; j++) {
        var it = items[j];
        var linkMatch = it.match(/<div class="thumb"><a\s+href="([^"]+)"/i)
          || it.match(/<a\s+href="([^"]+)"/i);
        if (!linkMatch) continue;
        var aurl = linkMatch[1];
        if (seen[aurl]) continue;
        seen[aurl] = 1;
        var titleMatch = it.match(/<h2 class="jdlflm">([^<]+)<\/h2>/i)
          || it.match(/<a[^>]+title="([^"]+)"/i);
        var title = _cleanTitle(htmlText(titleMatch ? titleMatch[1] : ''));
        var img = (it.match(/<img[^>]+src="([^"]+)"/) || [])[1] || null;
        if (!title) continue;
        cards.push({
          id: aurl,
          title: title,
          url: aurl,
          cover: img,
          type: 'anime',
          sourceId: SOURCE_ID
        });
      }
      if (cards.length) {
        out.push({ title: secTitle, items: cards });
      }
    }
    return out;
  }).catch(function () { return []; });
}

// ── Detail & Episodes ────────────────────────────────────────────────────────
function getDetail(url, opts) {
  var aurl = String(url);
  return _get(aurl, SITE + '/').then(function (html) {
    var title = _cleanTitle(
      (html.match(/<b>Judul<\/b>\s*:\s*([^<]+)/i) || [])[1]
      || (html.match(/<div class="infozingle">[\s\S]*?<b>Judul<\/b>\s*:\s*([^<]+)/i) || [])[1]
      || (html.match(/<h1 class="jdlz">([^<]+)<\/h1>/i) || [])[1]
      || (html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || [])[1]
      || (aurl.match(/\/anime\/([^/]+)/) || [])[1]
      || ''
    );
    var japanese = htmlText((html.match(/<b>Japanese<\/b>\s*:\s*([^<]+)/i) || [])[1] || '');
    var poster = (html.match(/<img[^>]+class="attachment-post-thumbnail[^"]*"[^>]+src="([^"]+)"/i)
      || html.match(/<div class="fotoanime"><img[^>]+src="([^"]+)"/i) || [])[1] || null;
    var synopsis = htmlText((html.match(/<div class="sinopc">([\s\S]*?)<\/div>/i) || [])[1] || '');
    var statusRaw = htmlText((html.match(/<b>Status<\/b>\s*:\s*([^<]+)/i) || [])[1] || '').toLowerCase();
    var status = statusRaw.indexOf('ongoing') > -1 ? 'ongoing'
      : (statusRaw.indexOf('complete') > -1 ? 'completed' : 'unknown');

    var genres = [];
    var genreBlock = (html.match(/<b>Genres?<\/b>\s*:\s*([\s\S]*?)<\/p>/i) || [])[1] || '';
    var gMatch = genreBlock.match(/<a[^>]*>([^<]+)<\/a>/g) || [];
    for (var g = 0; g < gMatch.length; g++) {
      var gt = htmlText(gMatch[g]);
      if (gt) genres.push(gt);
    }

    var episodes = [];
    var epLists = html.split('<div class="episodelist">');
    for (var i = 1; i < epLists.length; i++) {
      var block = epLists[i].split('</ul>')[0];
      var liItems = block.split('<li>');
      for (var j = 1; j < liItems.length; j++) {
        var item = liItems[j];
        var linkMatch = item.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
        if (!linkMatch) continue;
        var epUrl = linkMatch[1];
        if (epUrl.indexOf('/episode/') === -1) continue;
        var rawEpTitle = htmlText(linkMatch[2]);
        var epDate = htmlText((item.match(/<span class="zeebr"[^>]*>([^<]+)<\/span>/i) || [])[1] || '');
        var numMatch = rawEpTitle.match(/Episode\s+(\d+)/i) || rawEpTitle.match(/(\d+)/);
        var num = numMatch ? parseInt(numMatch[1], 10) : (episodes.length + 1);
        episodes.push({
          id: epUrl,
          number: num,
          title: _cleanTitle(rawEpTitle),
          url: epUrl,
          date: epDate || null
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
function _extractFromEmbed(embedUrl, ref) {
  if (!embedUrl) return Promise.resolve([]);
  return _get(embedUrl, ref || SITE + '/').then(function (html) {
    if (!html) return [];
    var out = [];

    var addStream = function (sUrl, q) {
      if (!sUrl) return;
      sUrl = sUrl.replace(/\\/g, '');
      var isHls = /\.m3u8(\?|$)/i.test(sUrl);
      var quality = q || '720p';
      if (!q) {
        if (sUrl.indexOf('1080') > -1) quality = '1080p';
        else if (sUrl.indexOf('720') > -1) quality = '720p';
        else if (sUrl.indexOf('480') > -1) quality = '480p';
        else if (sUrl.indexOf('360') > -1) quality = '360p';
      }
      out.push({
        url: sUrl,
        quality: quality,
        container: isHls ? 'hls' : 'mp4',
        headers: { 'User-Agent': UA, 'Referer': embedUrl },
        kind: 'sub',
        audioLang: 'ja'
      });
    };

    // 1. Direct video file match
    var fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i)
      || html.match(/videoURL\s*=\s*["']([^"']+)["']/i)
      || html.match(/src\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i)
      || html.match(/<source[^>]+src="([^"]+)"/i)
      || html.match(/<video[^>]+src="([^"]+)"/i);

    if (fileMatch) {
      addStream(fileMatch[1]);
    }

    // 2. Packed JS evaluation (Vidhide, Streamwish, etc.)
    if (html.indexOf('eval(') > -1) {
      var unpacked = _unpack(html);
      if (unpacked) {
        var m3u8Match = unpacked.match(/https?:\/\/[^"'\s`\\]+\.m3u8[^"'\s`\\]*/i)
          || unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (m3u8Match) {
          addStream(m3u8Match[1] || m3u8Match[0]);
        }
      }
    }

    // 3. Nested iframe (e.g. Blogger or another player inside Desustream)
    var innerIfr = (html.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
    if (innerIfr && innerIfr !== embedUrl) {
      return _extractFromEmbed(innerIfr, embedUrl).then(function (nested) {
        return out.concat(nested);
      });
    }

    return out;
  }).catch(function () { return []; });
}

function getVideoSources(episodeUrl) {
  return _get(episodeUrl, SITE + '/').then(function (epHtml) {
    if (!epHtml) return Promise.reject(new Error('Otakudesu: episode page not found'));
    var sources = [], seenUrls = {};

    var pushSource = function (item) {
      if (item && item.url && !seenUrls[item.url]) {
        seenUrls[item.url] = 1;
        sources.push(item);
      }
    };

    // 1. Default iframe embed
    var mainIfr = (epHtml.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
    var pMain = mainIfr ? _extractFromEmbed(mainIfr, episodeUrl) : Promise.resolve([]);

    return pMain.then(function (sMain) {
      for (var i = 0; i < sMain.length; i++) pushSource(sMain[i]);

      // 2. Resolve mirrors from .mirrorstream via admin-ajax.php
      var nonceActions = epHtml.match(/action:\s*"([a-f0-9]{32})"/g) || [];
      if (nonceActions.length < 2) {
        if (sources.length) return sources;
        throw new Error('Otakudesu: no playable stream found');
      }

      var streamAction = (nonceActions[0].match(/"([a-f0-9]{32})"/) || [])[1];
      var nonceAction = (nonceActions[1].match(/"([a-f0-9]{32})"/) || [])[1];

      return _post(SITE + '/wp-admin/admin-ajax.php', { action: nonceAction }, episodeUrl)
        .then(function (nonceRes) {
          var nonce = nonceRes && nonceRes.data;
          if (!nonce) return sources;

          var mirrorLinks = epHtml.match(/<a[^>]+data-content="([^"]+)"[^>]*>([^<]+)<\/a>/g) || [];
          var chain = Promise.resolve();

          var checkMirror = function (linkTag) {
            var contentB64 = (linkTag.match(/data-content="([^"]+)"/) || [])[1];
            if (!contentB64) return;
            var decodedJson = _b64Decode(contentB64);
            var parsed;
            try { parsed = JSON.parse(decodedJson); } catch (e) { parsed = null; }
            if (!parsed) return;

            var payload = { id: parsed.id, i: parsed.i, q: parsed.q, nonce: nonce, action: streamAction };
            chain = chain.then(function () {
              return _post(SITE + '/wp-admin/admin-ajax.php', payload, episodeUrl).then(function (sRes) {
                if (!sRes || !sRes.data) return;
                var htmlBlock = _b64Decode(sRes.data);
                var ifrSrc = (htmlBlock.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
                if (ifrSrc) {
                  return _extractFromEmbed(ifrSrc, episodeUrl).then(function (mSources) {
                    for (var k = 0; k < mSources.length; k++) {
                      if (parsed.q) mSources[k].quality = parsed.q;
                      pushSource(mSources[k]);
                    }
                  });
                }
              });
            });
          };

          for (var m = 0; m < Math.min(mirrorLinks.length, 6); m++) {
            checkMirror(mirrorLinks[m]);
          }

          return chain.then(function () { return sources; });
        });
    }).then(function (finalSources) {
      if (!finalSources.length) throw new Error('Otakudesu: no playable stream found');
      return finalSources;
    });
  });
}
