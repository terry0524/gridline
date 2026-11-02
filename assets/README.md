# GRIDLINE visual assets

- Barlow Condensed 700 and Manrope 400/700 are self-hosted, unmodified Google Fonts distributions. Their SIL Open Font License notices are included in `fonts/`.
- Search, Sun and Moon are unmodified Tabler outline icons. MIT license is included in `icons/`.
- `circuits/*.svg` are lightweight visualizations of actual historical OpenF1 replay reference-lap coordinates, projected using the stored circuit rotation. They are not generated illustrations or Live position data. `circuits/sources.json` records the source session, reference lap, source year and verified replay SHA-256 for each asset.
- Historical geometry is labeled by reference year in the UI. Missing circuit assets fall back to event typography; no track is invented.
- No third-party editorial photographs, F1 logos, generated concept images or generated statistics are shipped.

Sources: [Barlow](https://github.com/google/fonts/tree/main/ofl/barlowcondensed), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope), [Tabler](https://github.com/tabler/tabler-icons), [OpenF1](https://openf1.org/docs/), [verified replay library](https://github.com/terry0524/gridline/releases/tag/replay-library-v1).
