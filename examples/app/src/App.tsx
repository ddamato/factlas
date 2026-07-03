import { Alert } from './components/Alert';
import { Badge } from './components/Badge';
import { Button, Ghost } from './components/Button';
import { Card } from './components/Card';
// A "forbidden" package — surfaces as an `import` fact (allowed-packages policy).
import { LegacyModal } from '@acme/legacy-ui';
import './styles/globals.css';

export function App({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="container">
      {/* Component usage → jsx.element (imported_from) + jsx.prop values */}
      <Button variant="primary" size="lg" disabled>
        Save
      </Button>

      {/* Dynamic + static-union prop values */}
      <Ghost tone={theme} align={theme === 'dark' ? 'start' : 'center'}>
        Cancel
      </Ghost>

      <Card tone="danger" active />
      <Badge count={3} />
      <LegacyModal open />

      {/* DOM element with an inline style → jsx.attribute (no-inline-style) */}
      <hr style={{ borderColor: '#DDD' }} />

      <Alert />
    </div>
  );
}
