import { DocumentSummary } from '../../../core/models/document-summary.model';

export interface RenameEvent {
  document: DocumentSummary;
  newName: string;
}
