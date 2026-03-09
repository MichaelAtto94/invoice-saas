export class CreateQuoteDto {
  clientId: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  costPrice?: number; // cents snapshot (if no itemId)

  lines: Array<{
    itemId?: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number; // cents snapshot (only used when itemId is null)
  }>;
}
