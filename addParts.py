#!/usr/bin/env python3
import json
from pathlib import Path

# Define paths
cars_path = Path.cwd()
parts_txt = cars_path / "parts.txt"
search_json = cars_path / "extensions" / "Search" / "search.json"

# Check if parts.txt exists
if not parts_txt.exists():
    print("Error: parts.txt not found!")
    exit(1)

# Read parts from parts.txt and convert to array
with open(parts_txt, 'r', encoding='utf-8') as f:
    parts_list = [line.strip() for line in f if line.strip()]

# Read existing search.json to get other fields
try:
    with open(search_json, 'r', encoding='utf-8') as f:
        search_config = json.load(f)
except:
    # If parsing fails, create default config
    search_config = {
        "baseUrl": "https://www.ebay.com/sch/i.html?",
        "soldParams": "_sacat=0&_from=R40&_trksid=p2334524.m570.l1313&rt=nc&_osacat=0&LH_ItemCondition=3000&LH_Sold=1",
        "liveParams": "_sacat=0&_from=R40&_osacat=0&LH_ItemCondition=3000&rt=nc",
        "car": "2007 toyota camry"
    }

# Update the parts field as an array
search_config['parts'] = parts_list

# Write back to search.json
with open(search_json, 'w', encoding='utf-8') as f:
    json.dump(search_config, f, indent=2)

print(f"✅ Updated search.json with parts from parts.txt")
print(f"Location: {search_json}")
print(f"Total parts: {len(parts_list)}")

