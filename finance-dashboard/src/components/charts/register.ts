// Register only the Chart.js pieces the app uses (keeps the bundle small and
// avoids "X is not a registered controller" errors). Imported by every canvas
// module, so it runs before the first chart renders.
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
)

Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
Chart.defaults.font.size = 12
