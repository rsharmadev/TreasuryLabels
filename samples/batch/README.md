# Batch test fixtures

Upload `applications.csv` and all four images in `labels/`.

| Image | Expected result |
| --- | --- |
| `intake-07.png` | Matches `CANYON-750` |
| `merchant-photo.png` | Matches `CANYON-1L` |
| `archive-scan.png` | Matches `SIERRA-750` |
| `unknown-item.png` | No application matches |

The two Canyon Oak images share the same brand, class/type, and ABV. Their different net contents demonstrate that filenames and producer details are not used to choose an application.
