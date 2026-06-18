export interface User { id: string | number; name: string; pin: string; role: "admin" | "auctioneer" | "collector"; }
export interface Buyer { id: string | number; nickname: string; lifetime_debt: number; credit_limit: number; }
export interface Source { id: string | number; name: string; date: string; is_completed: boolean; is_archived: boolean; rate_per_kg?: number; }
export interface Transaction { id: string | number; source_id: string | number; buyer_id: string | number; weight: number; price_per_kg: number; total_price: number; date: string; fish_type: string; added_by: string; timestamp?: string | number; device_id?: string; }
export interface DailyCollection { id: string | number; buyer_id: string | number; date: string; total_owed_today: number; amount_paid: number; is_rolled_over: boolean; is_approved: boolean; created_at?: string; }
export interface SourcePayment { id: string | number; source_id: string | number; date: string; total_kg: number; sale_total: number; amount_paid_to_source: number; commission: number; is_settled: boolean; items_json?: string; rate_per_kg?: number; }
export interface Setting { key: string; value: string; }
export interface NFCData { users: User[]; buyers: Buyer[]; sources: Source[]; transactions: Transaction[]; daily_collections: DailyCollection[]; source_payments: SourcePayment[]; settings: Setting[]; }
export interface QueueItem { id: string | number; table: keyof NFCData; action: "insert" | "update" | "delete" | "upsert"; payload: any; timestamp: number; }
