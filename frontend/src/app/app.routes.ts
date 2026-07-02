import { Routes } from '@angular/router';

import { EditorPageComponent } from './features/editor/editor-page/editor-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'editor' },
  { path: 'editor', component: EditorPageComponent },
  { path: 'editor/:documentId', component: EditorPageComponent },
  { path: '**', redirectTo: 'editor' },
];
