#!/usr/bin/env python3
import os
import shutil
from pathlib import Path

# Define paths
downloads_path = Path.home() / "Downloads"
cars_path = Path(__file__).parent
output_path = cars_path / "cars.csv"

# Get all CSV files in Downloads
csv_files = list(downloads_path.glob("*.csv"))

if not csv_files:
    print("No CSV files found in Downloads folder")
    exit(1)

# Find the most recent CSV file
latest_file = max(csv_files, key=lambda f: f.stat().st_mtime)
print(f"Most recent CSV: {latest_file.name}")

# Copy to cars.csv
shutil.copy(latest_file, output_path)
print(f"Copied to: {output_path}")
