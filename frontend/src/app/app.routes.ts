import { Routes } from '@angular/router';

import { documentResolver } from './core/resolvers/document.resolver';
import { DocumentsListPageComponent } from './features/documents/documents-list-page/documents-list-page.component';
import { EditorPageComponent } from './features/editor/editor-page/editor-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'editor' },
  { path: 'editor', component: EditorPageComponent },
  {
    path: 'editor/:documentId',
    component: EditorPageComponent,
    resolve: { document: documentResolver },
  },
  { path: 'documents', component: DocumentsListPageComponent },
  { path: '**', redirectTo: 'editor' },
];
