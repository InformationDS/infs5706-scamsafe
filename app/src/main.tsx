import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from './Workbench';
import './style.css';
import { ModulePreview } from './module-preview';
import { CaseWorkbench } from './workbench/CaseWorkbench';
import { moduleNames, type ModuleName } from '../../shared/module-ports';

const moduleName = new URLSearchParams(location.search).get('module');
const legacy = new URLSearchParams(location.search).get('view') === 'foundation';
const candidate = new URLSearchParams(location.search).get('view') === 'workbench';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{moduleNames.includes(moduleName as ModuleName) ? <ModulePreview name={moduleName as ModuleName} /> : legacy ? <Workbench /> : candidate ? <CaseWorkbench /> : <ModulePreview name="model" integrated />}</React.StrictMode>);
