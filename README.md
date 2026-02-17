# Architect Directory Scraper

This script scrapes all architect and landscape architect information from [architectdirectory.co.uk](https://architectdirectory.co.uk/).

## Features

- Scrapes all architect practices (2200+)
- Scrapes all landscape architect practices (100+)
- Extracts comprehensive practice information including:
  - Practice name and description
  - Contact information (email, website, address)
  - Business metrics (turnover, years active, reach)
  - Staff demographics
  - Standards and certifications
- Exports data to both JSON and CSV formats
- Respectful rate limiting (1 second delay between requests)

## Installation

1. Install Python dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Full Scrape

To scrape all architects and landscape architects:

```bash
python scrape_architects.py
```

This will:

- Scrape all listing pages to find practice URLs
- Scrape each practice page for detailed information
- Save results to `architects.json` and `architects.csv`

### Test Mode

To test with a limited number of practices, edit `scrape_architects.py` and modify the `main()` function:

```python
practices = scraper.scrape_all(include_landscape=True, max_practices=10)  # Test with 10 practices
```

## Output Files

- **architects.json**: Complete data in JSON format (preserves nested structures)
- **architects.csv**: Flattened data in CSV format (suitable for Excel/Google Sheets)

## Data Fields

Each practice record includes:

- `name`: Practice name
- `url`: Practice page URL
- `website`: Practice website URL
- `email`: Contact email
- `address`: Physical address
- `contact`: Contact person name
- `description`: Practice description
- `years_active`: Years the practice has been active
- `turnover`: Annual turnover range
- `reach`: Geographic reach (e.g., "Single Office")
- `standards`: List of standards/certifications (RIBA, etc.)
- `professional_staff`: Number of professional staff
- `percent_directorship_female`: Percentage of female directors
- `percent_female`: Percentage of female staff
- `percent_directorship_bme`: Percentage of BME directors
- `percent_bme`: Percentage of BME staff

## Notes

- The scraper includes a 1-second delay between requests to be respectful to the server
- Scraping all 2300+ practices will take approximately 40-60 minutes
- Some fields may be empty if not available on the practice page
- The script handles errors gracefully and continues scraping even if individual pages fail

## Troubleshooting

If you encounter issues:

1. **Connection errors**: Check your internet connection
2. **Rate limiting**: Increase the delay in `ArchitectScraper(delay=2.0)` for slower scraping
3. **Missing data**: Some practices may have incomplete profiles
4. **Pagination issues**: The script tries multiple pagination patterns, but website structure changes may require updates
