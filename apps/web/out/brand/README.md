# Brand assets

Drop the official BDT Connect brand files here:

| File                              | Use                                |
| --------------------------------- | ---------------------------------- |
| `bdt-connect-plaque.png` (or .svg)| The full brushed-metal plaque mark |
| `bdt-connect-mark.svg`            | Wordmark only, for the nav         |
| `bdt-connect-favicon.svg`         | Favicon (square, transparent bg)   |

Until they exist, `components/landing/Logo.tsx` renders a CSS approximation. When the official assets land, swap the component's inner JSX to use `next/image` — keep the `<Logo />` API the same so consumers don't change.
