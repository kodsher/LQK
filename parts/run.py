import csv
import json
import os
import glob
from pathlib import Path

def load_existing_data():
    """Load existing data from data.json"""
    if os.path.exists('data.json'):
        with open('data.json', 'r', encoding='utf-8') as file:
            return json.load(file)
    return []

def save_data(data):
    """Save data to data.json"""
    with open('data.json', 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=2)
    print(f'\n✓ Saved {len(data)} total records to data.json')

def process_csv(csv_file, existing_data):
    """Process a single CSV file and return new records"""
    new_records = []
    existing_search_terms = {item['searchTerm'] for item in existing_data}

    print(f'\n📄 Processing: {csv_file}')

    try:
        with open(csv_file, 'r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)

            # Validate CSV has required columns
            required_columns = ['Search Term', 'Sell Through Rate', 'Sold Count']
            if not all(col in reader.fieldnames for col in required_columns):
                print(f'  ⚠️  Skipping {csv_file}: Missing required columns')
                print(f'     Required: {required_columns}')
                print(f'     Found: {reader.fieldnames}')
                return new_records

            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    search_term = row['Search Term'].strip()
                    sell_through = row['Sell Through Rate'].strip().replace('%', '')
                    sold_count = row['Sold Count'].strip()

                    # Skip if search term is empty
                    if not search_term:
                        print(f'  ⚠️  Row {row_num}: Empty search term, skipping')
                        continue

                    # Check for duplicate
                    if search_term in existing_search_terms:
                        print(f'  ⊗ Row {row_num}: Duplicate "{search_term}" - skipping')
                        continue

                    # Convert to integers
                    try:
                        percentage = int(sell_through)
                        sold_count_int = int(sold_count)
                    except ValueError as e:
                        print(f'  ⚠️  Row {row_num}: Invalid number format in "{search_term}" - skipping')
                        continue

                    # Add to new records
                    new_record = {
                        'searchTerm': search_term,
                        'percentage': percentage,
                        'soldCount': sold_count_int
                    }
                    new_records.append(new_record)
                    existing_search_terms.add(search_term)  # Add to set to prevent duplicates within same CSV

                    print(f'  ✓ Row {row_num}: Added "{search_term}" ({percentage}% sold: {sold_count_int})')

                except Exception as e:
                    print(f'  ⚠️  Row {row_num}: Error processing row - {e}')
                    continue

    except FileNotFoundError:
        print(f'  ✗ File not found: {csv_file}')
    except Exception as e:
        print(f'  ✗ Error reading {csv_file}: {e}')

    return new_records

def main():
    """Main function to process CSV files and update data.json"""
    print('=' * 70)
    print('🚗 CSV to JSON Processor - Adding to data.json')
    print('=' * 70)

    # Load existing data
    print('\n📂 Loading existing data.json...')
    existing_data = load_existing_data()
    print(f'   Found {len(existing_data)} existing records')

    # Find all CSV files in current directory
    csv_files = glob.glob('*.csv')

    if not csv_files:
        print('\n⚠️  No CSV files found in current directory!')
        print('   Place CSV files in the same directory as run.py')
        return

    print(f'\n📋 Found {len(csv_files)} CSV file(s):')
    for csv_file in csv_files:
        print(f'   - {csv_file}')

    # Process each CSV file
    all_new_records = []

    for csv_file in csv_files:
        # Skip the converted file if it exists
        if csv_file == 'search-results-2026-01-19 (5).csv':
            new_records = process_csv(csv_file, existing_data)
            all_new_records.extend(new_records)

    # Add new records to existing data
    if all_new_records:
        print(f'\n📊 Summary:')
        print(f'   - Records before: {len(existing_data)}')
        print(f'   - New records added: {len(all_new_records)}')
        print(f'   - Records after: {len(existing_data) + len(all_new_records)}')

        # Merge and save
        updated_data = existing_data + all_new_records
        save_data(updated_data)

        print('\n✅ Success! data.json has been updated.')
        print(f'\n💡 Refresh your browser at http://localhost:8000/index.html to see changes')
    else:
        print('\n📊 Summary:')
        print(f'   - No new records to add')
        print(f'   - Total records: {len(existing_data)}')
        print('\n✅ data.json is already up to date!')

    print('=' * 70)

if __name__ == '__main__':
    main()
