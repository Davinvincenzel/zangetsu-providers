#!/usr/bin/env python3
"""
Cinejoy Scraper Script using Scrapling (https://cinejoy.to)
Supports searching movies/series, checking server status, and extracting stream URLs.
"""

import sys
import json
import subprocess
from scrapling.fetchers import Fetcher

SITE = "https://cinejoy.to"
BASE_API = "https://api.shegu.st"
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_KEY = "8476a7ab80ad76f0936744df0430e67c"

def get_servers():
    """Fetch active streaming servers using Scrapling Fetcher."""
    print("[*] Fetching streaming servers via Scrapling...")
    res = Fetcher.get(f"{BASE_API}/servers", headers={"Referer": f"{SITE}/"})
    if res.status == 200:
        data = json.loads(res.body.decode("utf-8"))
        servers = data.get("servers", [])
        print(f"[+] Found {len(servers)} servers:")
        for s in servers:
            print(f"    - {s.get('name')}: status={s.get('status')} 4k={s.get('4k')}")
        return servers
    print(f"[-] Failed to fetch servers: HTTP {res.status}")
    return []

def search_media(query: str):
    """Search for movies and TV series using TMDB API."""
    print(f"[*] Searching for '{query}'...")
    url = f"{TMDB_BASE}/search/multi?api_key={TMDB_KEY}&query={query}&page=1"
    res = Fetcher.get(url, headers={"Referer": f"{SITE}/"})
    if res.status == 200:
        data = json.loads(res.body.decode("utf-8"))
        results = [
            item for item in data.get("results", [])
            if item.get("media_type") in ("movie", "tv")
        ]
        print(f"[+] Found {len(results)} items:")
        for idx, item in enumerate(results[:5], 1):
            title = item.get("title") or item.get("name")
            mtype = item.get("media_type")
            tmdb_id = item.get("id")
            year = (item.get("release_date") or item.get("first_air_date") or "")[:4]
            print(f"    {idx}. [{mtype.upper()}] {title} ({year}) - TMDB ID: {tmdb_id}")
        return results
    return []

def get_stream_urls(url: str):
    """Resolve direct HLS stream sources using the Cinejoy provider engine."""
    print(f"[*] Resolving streams for: {url}")
    script = f"""
    const fs = require('fs');
    const vm = require('vm');
    const code = fs.readFileSync('providers/cinejoy.js', 'utf8');
    const context = {{
        fetch: globalThis.fetch,
        WebAssembly: globalThis.WebAssembly,
        crypto: globalThis.crypto,
        TextEncoder: globalThis.TextEncoder,
        TextDecoder: globalThis.TextDecoder,
        Buffer: globalThis.Buffer,
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout
    }};
    vm.createContext(context);
    vm.runInContext(code, context);
    context.getVideoSources('{url}').then(sources => {{
        console.log('RESULT:' + JSON.stringify(sources));
    }}).catch(err => {{
        console.error('ERROR:' + err.message);
        process.exit(1);
    }});
    """
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    for line in proc.stdout.splitlines():
        if line.startswith("RESULT:"):
            sources = json.loads(line[7:])
            print(f"[+] Extracted {len(sources)} stream source(s):")
            for s in sources:
                print(f"    - [{s.get('quality')}] {s.get('label')}")
                print(f"      URL: {s.get('url')}")
            return sources
    if proc.returncode != 0:
        print(f"[-] Stream extraction failed: {proc.stderr.strip()}")
    return []

def main():
    print("=" * 60)
    print(" Cinejoy Stream Scraper (Powered by Scrapling)")
    print("=" * 60)
    get_servers()
    print()
    query = sys.argv[1] if len(sys.argv) > 1 else "Fight Club"
    results = search_media(query)
    if results:
        first = results[0]
        tmdb_id = first.get("id")
        mtype = first.get("media_type")
        if mtype == "tv":
            watch_url = f"{SITE}/watch/tv/{tmdb_id}/1/1"
        else:
            watch_url = f"{SITE}/watch/movie/{tmdb_id}"
        print()
        get_stream_urls(watch_url)

if __name__ == "__main__":
    main()
