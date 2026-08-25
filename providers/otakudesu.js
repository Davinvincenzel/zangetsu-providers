// Otakudesu — Ultra-Fast Indonesian Anime Provider for Zangetsu (otakudesu.blog)

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
    version: '1.0.8'
  };
}

function _get(url, ref, timeoutMs) {
  var h = { 'User-Agent': UA, 'Referer': ref || SITE + '/' };
  return fetch(url, { headers: h, timeoutMs: timeoutMs || 2000 })
    .then(function (r) { return r.body || ''; })
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
  return fetch(url, { method: 'POST', headers: h, body: body, timeoutMs: timeoutMs || 1500 })
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

function _b64Decode(b64) {
  if (typeof atob === 'function') return atob(b64);
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var str = String(b64).replace(/[=]+$/, '');
  var out = '';
  for (var bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? out += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return out;
}

function _unpack(code) {
  try {
    var match = code.match(/eval\s*\(\s*function\s*\([^\)]*\)\s*\{[\s\S]*?\}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\s*\.split\(/i)
      || code.match(/}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\s*\.split\(/i);
    if (!match) return '';
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
  var url = SITE + '/?s=' + encodeURIComponent(q) + '&post_type=anime';
  return _get(url, SITE + '/', 3000).then(function (html) {
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
  return _get(SITE + '/', SITE + '/', 3000).then(function (html) {
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
  return _get(aurl, SITE + '/', 3000).then(function (html) {
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
        if (epUrl.indexOf('/episode/') === -1 || epUrl.indexOf('pembatas-episode') > -1) continue;
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
function _extractFromEmbed(embedUrl, ref, timeoutMs, depth) {
  if (!embedUrl) return Promise.resolve([]);
  if (/blogger\.com|filedon\.co|mega\.nz|krakenfiles\.com|nekoclouds\.com|moedesu/i.test(embedUrl)) {
    return Promise.resolve([]);
  }
  return _get(embedUrl, ref || SITE + '/', timeoutMs || 1800).then(function (html) {
    if (!html) return [];
    var out = [];

    var addStream = function (sUrl, q) {
      if (!sUrl) return;
      sUrl = sUrl.replace(/\\/g, '').trim();
      if (sUrl.indexOf('http') !== 0 || sUrl.indexOf('novideo') > -1) return;
      var isHls = /\.m3u8(\?|$)/i.test(sUrl) || /\/hls[23]?\//i.test(sUrl);
      var isGvideo = /googlevideo\.com/i.test(sUrl);
      var isArchive = /archive\.org/i.test(sUrl);

      // Clean headers so mobile ExoPlayer/AVPlayer do not receive 403 Forbidden
      var streamHeaders = { 'User-Agent': UA };
      if (isGvideo) {
        streamHeaders['Referer'] = 'https://www.blogger.com/';
      } else if (!isArchive) {
        streamHeaders['Referer'] = embedUrl;
      }

      out.push({
        url: sUrl,
        quality: q || '720p',
        container: isHls ? 'hls' : 'mp4',
        headers: streamHeaders,
        kind: 'sub',
        audioLang: 'ja'
      });
    };

    // 1. Direct video source or file URL
    var fileMatch = html.match(/const\s+videoURL\s*=\s*["']([^"']+)["']/i)
      || html.match(/videoURL\s*=\s*["']([^"']+)["']/i)
      || html.match(/<source[^>]+src=["']([^"']+)["']/i)
      || html.match(/file\s*:\s*["'](https?:[^"']+\.(?:mp4|m3u8)[^"']*)["']/i)
      || html.match(/src\s*:\s*["'](https?:[^\"']+\.(?:mp4|m3u8)[^\"']*)[\"']/i)
      || html.match(/player\.src\(\s*\{[^}]*src:\s*["']([^"']+)["']/i)
      || html.match(/property=["']og:video["']\s+content=["']([^"']+)["']/i)
      || html.match(/<video[^>]+src=["']([^"']+)["']/i);

    if (fileMatch && fileMatch[1]) {
      addStream(fileMatch[1]);
      return out;
    }

    // 2. Packed JS evaluation (VidHide, StreamWish, etc.)
    if (html.indexOf('eval(') > -1) {
      var unpacked = _unpack(html);
      if (unpacked) {
        var m3u8Match = unpacked.match(/https?:\/\/[^"'\s`\\]+\.m3u8[^"'\s`\\]*/i)
          || unpacked.match(/https?:\/\/[^"'\s`\\]+\/hls[23]?\/[^"'\s`\\]*/i)
          || unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (m3u8Match) {
          addStream(m3u8Match[1] || m3u8Match[0]);
          return out;
        }
      }
    }

    // 3. Nested iframe (e.g. desudrive wrapping yourupload)
    if (!depth || depth < 2) {
      var nestedIfr = (html.match(/<iframe[^>]+src=["']([^"']+)["']/i) || [])[1];
      if (nestedIfr && nestedIfr !== embedUrl && !/blogger\.com|mega\.nz|moedesu/i.test(nestedIfr)) {
        return _extractFromEmbed(nestedIfr, embedUrl, timeoutMs, (depth || 0) + 1);
      }
    }

    return out;
  }).catch(function () { return []; });
}

function _resolveFallbackMirrors(epHtml, episodeUrl) {
  var nonceActions = epHtml.match(/action:\s*"([a-f0-9]{32})"/g) || [];
  if (nonceActions.length < 2) return Promise.resolve([]);

  var streamAction = (nonceActions[0].match(/"([a-f0-9]{32})"/) || [])[1];
  var nonceAction = (nonceActions[1].match(/"([a-f0-9]{32})"/) || [])[1];

  return _post(SITE + '/wp-admin/admin-ajax.php', { action: nonceAction }, episodeUrl, 1500)
    .then(function (nonceRes) {
      var nonce = nonceRes && nonceRes.data;
      if (!nonce) return [];

      var mirrorLinks = epHtml.match(/<a[^>]+data-content="([^"]+)"[^>]*>([^<]+)<\/a>/g) || [];
      var candidates = [];

      for (var m = 0; m < mirrorLinks.length; m++) {
        var linkTag = mirrorLinks[m];
        var contentB64 = (linkTag.match(/data-content="([^"]+)"/) || [])[1];
        if (!contentB64) continue;
        var decoded = _b64Decode(contentB64);
        var parsed;
        try { parsed = JSON.parse(decoded); } catch (e) { parsed = null; }
        if (!parsed) continue;

        var name = ((linkTag.match(/>([^<]+)<\/a>/) || [])[1] || '').trim().toLowerCase();
        if (name.indexOf('moedesu') > -1) continue; // dead server

        var q = parsed.q || '';
        var is720 = q.indexOf('720') > -1 || q.indexOf('1080') > -1;
        var is480 = q.indexOf('480') > -1;
        var is360 = q.indexOf('360') > -1;
        var isOndesu = name.indexOf('ondesu') > -1 || name.indexOf('odstream') > -1 || name.indexOf('odcdn') > -1 || name.indexOf('arcg') > -1;
        var isVidhide = name.indexOf('vidhide') > -1;
        var isYu = name.indexOf('yourupload') > -1;
        var isMp4 = name.indexOf('mp4load') > -1 || name.indexOf('mp4upload') > -1;

        if (isVidhide || isOndesu || isYu || isMp4) {
          var score = 0;
          // VidHide HLS is universal across mobile players
          if (isVidhide) score += 35;
          if (isOndesu) score += 30;
          if (isYu) score += 20;
          if (isMp4) score += 15;
          if (is720) score += 10;
          else if (is480) score += 5;
          else if (is360) score += 1;
          candidates.push({ parsed: parsed, name: name, score: score, q: q });
        }
      }

      candidates.sort(function (a, b) { return b.score - a.score; });

      // Deduplicate by quality + provider, collect up to 3 diverse mirrors
      var selected = [];
      var seenQualities = {};
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        var provider = c.name.indexOf('vidhide') > -1 ? 'vidhide'
          : (c.name.indexOf('yourupload') > -1 ? 'yu'
          : (c.name.indexOf('mp4') > -1 ? 'mp4' : 'ondesu'));
        var key = c.q + '_' + provider;
        if (!seenQualities[key]) {
          seenQualities[key] = 1;
          selected.push(c);
          if (selected.length >= 3) break;
        }
      }

      var tasks = selected.map(function (c) {
        var payload = { id: c.parsed.id, i: c.parsed.i, q: c.parsed.q, nonce: nonce, action: streamAction };
        return _post(SITE + '/wp-admin/admin-ajax.php', payload, episodeUrl, 1500).then(function (sRes) {
          if (!sRes || !sRes.data) return [];
          var htmlBlock = _b64Decode(sRes.data);
          var ifrSrc = (htmlBlock.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
          if (!ifrSrc) return [];
          return _extractFromEmbed(ifrSrc, episodeUrl, 1800).then(function (mSources) {
            for (var k = 0; k < mSources.length; k++) {
              if (c.parsed.q) mSources[k].quality = c.parsed.q;
            }
            return mSources;
          });
        }).catch(function () { return []; });
      });

      return Promise.all(tasks).then(function (nested) {
        var flat = [];
        for (var i = 0; i < nested.length; i++) {
          for (var j = 0; j < nested[i].length; j++) flat.push(nested[i][j]);
        }
        return flat;
      });
    }).catch(function () { return []; });
}

function _isFastEmbedHost(u) {
  if (!u || /moedesu|nekoclouds|blogger|mega|filedon/i.test(u)) return false;
  return /desustream\.(?:net|me)\/dstream\/(?:odcdn|ondesu|otakuplay)/i.test(u)
    || /odvidhide\.com\/embed/i.test(u)
    || /vidhidepro\.com\/embed/i.test(u)
    || /mp4upload\.com\/embed/i.test(u);
}

function getVideoSources(episodeUrl) {
  return _get(episodeUrl, SITE + '/', 2000).then(function (epHtml) {
    if (!epHtml) return Promise.reject(new Error('Otakudesu: episode page not found'));

    var mainIfr = (epHtml.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
    
    // FAST PATH: Check verified fast player directly
    if (_isFastEmbedHost(mainIfr)) {
      return _extractFromEmbed(mainIfr, episodeUrl, 1800).then(function (mainSources) {
        if (mainSources && mainSources.length > 0) {
          return mainSources;
        }
        return _resolveFallbackMirrors(epHtml, episodeUrl);
      });
    }

    // For all other hosts (Blogger, Nekoclouds, Moedesu, Filedon, Mega), resolve working mirrors immediately
    return _resolveFallbackMirrors(epHtml, episodeUrl);
  }).then(function (sources) {
    if (!sources || !sources.length) throw new Error('Otakudesu: no playable stream found');
    return sources;
  });
}
