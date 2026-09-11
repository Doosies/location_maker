import { MapPlaceholder } from './ui/MapPlaceholder';

export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>location maker</h1>
        <p>주소를 여러 줄 붙여넣으면 지도에 표시한다.</p>
      </header>
      <main className="app__body">
        <MapPlaceholder />
      </main>
    </div>
  );
}
