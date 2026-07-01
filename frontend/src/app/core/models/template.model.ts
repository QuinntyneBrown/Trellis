import { TemplateCategory } from './template-category.model';

export interface Template {
  key: string;
  name: string;
  category: TemplateCategory;
  content: string;
}
