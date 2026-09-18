import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import SquadView from './components/SquadView.jsx';
import SurveyPage from './components/SurveyPage.jsx';
import './styles.css';
import { initTheme } from './components/ThemePicker.jsx';

initTheme();

const params   = new URLSearchParams(window.location.search);
const view     = params.get('view');
const date     = params.get('date');
const surveyId = params.get('survey');

const root = document.getElementById('root');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {view === 'squad'  ? <SquadView dateParam={date} />      :
     view === 'survey' ? <SurveyPage surveyId={surveyId} />  :
     <App />}
  </React.StrictMode>
);
