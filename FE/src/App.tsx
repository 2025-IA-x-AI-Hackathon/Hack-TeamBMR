import { Navigate, Route, Routes, BrowserRouter } from 'react-router-dom';
import { SplashScreen } from './components/SplashScreen';
import { MainScreen } from './components/MainScreen';
import { AddRoomScreen } from './components/AddRoomScreen';
import { RoomChecklistScreen } from './components/RoomChecklistScreen';
import { RoomCreationSuccessScreen } from './components/RoomCreationSuccessScreen';
import { RoomDetailScreen } from './components/RoomDetailScreen';
import { RoomMonitoringScreen } from './components/RoomMonitoringScreen';
import { DocumentUploadScreen } from './components/DocumentUploadScreen';
import { LlmReportScreen } from './components/LlmReportScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/home" element={<MainScreen />} />
        <Route path="/rooms/:roomId" element={<RoomDetailScreen />} />
        <Route path="/rooms/:roomId/report" element={<LlmReportScreen />} />
        <Route path="/rooms/:roomId/record" element={<RoomMonitoringScreen />} />
        <Route path="/rooms/:roomId/documents" element={<DocumentUploadScreen />} />
        <Route path="/add-room" element={<AddRoomScreen />} />
        <Route path="/checklist" element={<RoomChecklistScreen />} />
        <Route path="/success" element={<RoomCreationSuccessScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
