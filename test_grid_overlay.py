#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import time

# Start Playwright and open the test page
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # Open in visible browser
    page = browser.new_page()
    
    # Navigate to the test HTML file
    page.goto(f"file:///Users/jimvanderheiden/devprog2/mapmetrics-gl/cookie-test%20copy%202.html")
    
    # Wait for the map to load
    page.wait_for_timeout(3000)
    
    # Check console for grid overlay messages
    page.on("console", lambda msg: print(f"Console: {msg.text()}"))
    
    # Take a screenshot to see the current state
    page.screenshot(path="map_grid_test.png")
    print("Screenshot saved as map_grid_test.png")
    
    # Check if grid container exists
    grid_container = page.query_selector('.mapmetricsgl-tile-grid-container')
    if grid_container:
        print("Grid container element found!")
        
        # Check for individual tile grids
        tile_grids = page.query_selector_all('.mapmetricsgl-tile-grid')
        print(f"Number of tile grids found: {len(tile_grids)}")
        
        if tile_grids:
            # Get info about first tile grid
            first_grid = tile_grids[0]
            tile_key = first_grid.get_attribute('data-tile-key')
            print(f"First tile grid key: {tile_key}")
            
            # Get computed styles of first grid
            styles = page.evaluate('''() => {
                const grid = document.querySelector('.mapmetricsgl-tile-grid');
                if (grid) {
                    const computed = window.getComputedStyle(grid);
                    const rect = grid.getBoundingClientRect();
                    return {
                        display: computed.display,
                        opacity: computed.opacity,
                        position: computed.position,
                        width: computed.width,
                        height: computed.height,
                        transform: computed.transform,
                        backgroundColor: computed.backgroundColor,
                        border: computed.border,
                        rect: {
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height
                        }
                    };
                }
                return null;
            }''')
            print(f"First tile grid styles: {styles}")
    else:
        print("Grid container element NOT found!")
    
    # Test zoom to trigger grid display
    print("\nTesting zoom to trigger grid...")
    page.mouse.wheel(0, 100)  # Scroll to zoom
    page.wait_for_timeout(1000)
    
    # Check again after zoom
    tile_grids = page.query_selector_all('.mapmetricsgl-tile-grid')
    print(f"Number of tile grids after zoom: {len(tile_grids)}")
    
    # Keep browser open for manual inspection
    print("\nBrowser will stay open for 30 seconds for manual inspection...")
    time.sleep(30)
    
    browser.close()