export class CreateItemDto {
  name: string;
  description?: string;
  unitPrice: number; // store in cents? for now number
  costPrice?: number; // cents
  unit?: string; // e.g. "pcs", "hours"
}
