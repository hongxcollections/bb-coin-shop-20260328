# Width Fix Analysis

## Problem
All 3 pages (Home, Auctions, AuctionDetail) have empty space on the right side on mobile.

## Root Cause
The `.container` class in `index.css` has `padding-left: 1rem` and `padding-right: 1rem` (16px each side).
This is fine, but the issue is that the nav bar and content areas use `container` class which adds padding.

Looking at the screenshots more carefully:
- The content area is narrower than the screen width
- The right side has significant empty space (about 20-30% of screen)

This suggests the content is being constrained by something beyond just padding.
The nav uses `container` which is fine.
The main content uses `<div className="container py-6">` which should be 100% width with 1rem padding.

The real issue might be:
1. The auction list items have `max-width` or the flex layout isn't stretching
2. The nav items are pushing content and creating overflow

Let me check if there's a max-width constraint on mobile or if the content just isn't stretching.

Actually, looking at the screenshots again - the content IS using full width on the LEFT side, but the right side has empty space. This means the content container is correct width but the individual items inside aren't stretching to fill it.

Wait - looking more carefully at screenshot 1 (Auctions page), the list items seem to stop at about 60% width. The "競拍中" badge and countdown timer are at the edge of the content, but there's still space to the right.

This could be because the auction-list-item or its parent has a max-width, or the page has some horizontal scrolling issue.

Let me check the nav - it has many items that might overflow on mobile, causing the page to be wider than viewport, making it look like there's space on the right.
