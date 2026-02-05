#!/usr/bin/env python3
import os
import shutil
import csv
import json
from pathlib import Path

# Define paths
downloads_path = Path.home() / "Downloads"
cars_path = Path.cwd()
site_path = cars_path / "site"
output_path = site_path / "cars.json"

# Get all CSV files in Downloads
csv_files = list(downloads_path.glob("*.csv"))

if not csv_files:
    print("No CSV files found in Downloads folder")
    exit(1)

# Find the most recent CSV file
latest_file = max(csv_files, key=lambda f: f.stat().st_mtime)
print(f"Most recent CSV: {latest_file.name}")

# Read CSV and convert to JSON
data = []
with open(latest_file, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        data.append({
            'year': row['Year'],
            'make': row['Make'],
            'model': row['Model'],
            'location': row['Location'],
            'available': row['Available']
        })

# Write JSON to site folder
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print(f"Saved to: {output_path}")
print(f"Converted {len(data)} records")
