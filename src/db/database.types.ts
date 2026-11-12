
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "addresses": {
                  Row: {
                    "city": string,"country": string,"created_at": string,"full_name": string,"id": string,"is_default": boolean,"line1": string,"line2": string | null,"postal_code": string,"region": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"country": string,"created_at"?: string,"full_name": string,"id"?: string,"is_default"?: boolean,"line1": string,"line2"?: string | null,"postal_code": string,"region"?: string | null,"user_id": string
                  }
                  Update: {
                    "city"?: string,"country"?: string,"created_at"?: string,"full_name"?: string,"id"?: string,"is_default"?: boolean,"line1"?: string,"line2"?: string | null,"postal_code"?: string,"region"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "description": string,"id": string,"name": string,"slug": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"id"?: string,"name": string,"slug": string,"sort"?: number
                  }
                  Update: {
                    "description"?: string,"id"?: string,"name"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "created_at": string,"granted": boolean,"id": string,"policy_version": string,"purpose": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted": boolean,"id"?: string,"policy_version": string,"purpose": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted"?: boolean,"id"?: string,"policy_version"?: string,"purpose"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"coupons": {
                  Row: {
                    "active": boolean,"code": string,"description": string,"expires_at": string | null,"kind": string,"max_redemptions": number | null,"min_subtotal": number,"redemptions": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"description"?: string,"expires_at"?: string | null,"kind": string,"max_redemptions"?: number | null,"min_subtotal"?: number,"redemptions"?: number,"value"?: number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"description"?: string,"expires_at"?: string | null,"kind"?: string,"max_redemptions"?: number | null,"min_subtotal"?: number,"redemptions"?: number,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"data": NonNullable<Json>,"id": number,"order_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"order_id"?: string | null,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"order_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory": {
                  Row: {
                    "on_hand": number,"reserved": number,"updated_at": string,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "on_hand"?: number,"reserved"?: number,"updated_at"?: string,"variant_id": string
                  }
                  Update: {
                    "on_hand"?: number,"reserved"?: number,"updated_at"?: string,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: true
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"line_total": number,"order_id": string,"product_id": string | null,"product_name": string,"qty": number,"returned_qty": number,"sku": string,"unit_price": number,"variant_id": string | null,"variant_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"line_total": number,"order_id": string,"product_id"?: string | null,"product_name": string,"qty": number,"returned_qty"?: number,"sku": string,"unit_price": number,"variant_id"?: string | null,"variant_name": string
                  }
                  Update: {
                    "id"?: string,"line_total"?: number,"order_id"?: string,"product_id"?: string | null,"product_name"?: string,"qty"?: number,"returned_qty"?: number,"sku"?: string,"unit_price"?: number,"variant_id"?: string | null,"variant_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "cancelled_at": string | null,"carrier": string | null,"coupon_code": string | null,"created_at": string,"customer_id": string,"delivered_at": string | null,"discount": number,"id": string,"number": string,"payment_provider": string,"payment_scenario": string | null,"provider_ref": string | null,"refunded_total": number,"reservation_expires_at": string | null,"shipped_at": string | null,"shipping": number,"shipping_address": NonNullable<Json>,"shipping_method": string,"status_delivery": Database["public"]['Enums']["delivery_status"],"status_payment": Database["public"]['Enums']["payment_status"],"subtotal": number,"tax": number,"total": number,"tracking_number": string | null,"tracking_token": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"carrier"?: string | null,"coupon_code"?: string | null,"created_at"?: string,"customer_id": string,"delivered_at"?: string | null,"discount"?: number,"id"?: string,"number"?: string,"payment_provider"?: string,"payment_scenario"?: string | null,"provider_ref"?: string | null,"refunded_total"?: number,"reservation_expires_at"?: string | null,"shipped_at"?: string | null,"shipping"?: number,"shipping_address": NonNullable<Json>,"shipping_method": string,"status_delivery"?: Database["public"]['Enums']["delivery_status"],"status_payment"?: Database["public"]['Enums']["payment_status"],"subtotal": number,"tax"?: number,"total": number,"tracking_number"?: string | null,"tracking_token"?: string,"updated_at"?: string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"carrier"?: string | null,"coupon_code"?: string | null,"created_at"?: string,"customer_id"?: string,"delivered_at"?: string | null,"discount"?: number,"id"?: string,"number"?: string,"payment_provider"?: string,"payment_scenario"?: string | null,"provider_ref"?: string | null,"refunded_total"?: number,"reservation_expires_at"?: string | null,"shipped_at"?: string | null,"shipping"?: number,"shipping_address"?: NonNullable<Json>,"shipping_method"?: string,"status_delivery"?: Database["public"]['Enums']["delivery_status"],"status_payment"?: Database["public"]['Enums']["payment_status"],"subtotal"?: number,"tax"?: number,"total"?: number,"tracking_number"?: string | null,"tracking_token"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"order_id": string,"provider": string,"provider_ref": string | null,"scenario": string | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"order_id": string,"provider": string,"provider_ref"?: string | null,"scenario"?: string | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"order_id"?: string,"provider"?: string,"provider_ref"?: string | null,"scenario"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"processing_restrictions": {
                  Row: {
                    "activity": string,"restricted": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": string,"restricted"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "activity"?: string,"restricted"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_variants": {
                  Row: {
                    "active": boolean,"color": string | null,"id": string,"name": string,"price": number | null,"product_id": string,"size": string | null,"sku": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"color"?: string | null,"id"?: string,"name": string,"price"?: number | null,"product_id": string,"size"?: string | null,"sku": string,"sort"?: number
                  }
                  Update: {
                    "active"?: boolean,"color"?: string | null,"id"?: string,"name"?: string,"price"?: number | null,"product_id"?: string,"size"?: string | null,"sku"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "accent": string,"active": boolean,"base_price": number,"brand": string,"category_id": string,"created_at": string,"description": string,"featured": boolean,"id": string,"image_path": string | null,"name": string,"search_tsv": unknown,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent"?: string,"active"?: boolean,"base_price": number,"brand"?: string,"category_id": string,"created_at"?: string,"description"?: string,"featured"?: boolean,"id"?: string,"image_path"?: string | null,"name": string,"search_tsv"?: never,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "accent"?: string,"active"?: boolean,"base_price"?: number,"brand"?: string,"category_id"?: string,"created_at"?: string,"description"?: string,"featured"?: boolean,"id"?: string,"image_path"?: string | null,"name"?: string,"search_tsv"?: never,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"phone": string | null,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"id": string,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"id": string,"order_id": string,"reason": string,"return_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"order_id": string,"reason": string,"return_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"order_id"?: string,"reason"?: string,"return_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_return_id_fkey"
      columns: ["return_id"]
isOneToOne: false
      referencedRelation: "returns"
      referencedColumns: ["id"]
    }
                  ]
                },"returns": {
                  Row: {
                    "amount_suggested": number,"created_at": string,"customer_id": string,"id": string,"items": NonNullable<Json>,"order_id": string,"reason": string,"staff_note": string | null,"status": Database["public"]['Enums']["return_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_suggested"?: number,"created_at"?: string,"customer_id": string,"id"?: string,"items": NonNullable<Json>,"order_id": string,"reason": string,"staff_note"?: string | null,"status"?: Database["public"]['Enums']["return_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_suggested"?: number,"created_at"?: string,"customer_id"?: string,"id"?: string,"items"?: NonNullable<Json>,"order_id"?: string,"reason"?: string,"staff_note"?: string | null,"status"?: Database["public"]['Enums']["return_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "returns_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"simulation_state": {
                  Row: {
                    "id": number,"scenario": string,"step": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"scenario"?: string,"step"?: number,"updated_at"?: string
                  }
                  Update: {
                    "id"?: number,"scenario"?: string,"step"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"store_settings": {
                  Row: {
                    "id": number,"payment_provider": string,"simulation_enabled": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"payment_provider"?: string,"simulation_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "id"?: number,"payment_provider"?: string,"simulation_enabled"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "adjust_inventory":
{ Args: { "p_delta": number,"p_reason": string,"p_variant_id": string }; Returns: number
                           },
"admin_audit_log":
{ Args: { "p_action"?: string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "action": string,"actor_email": string,"actor_id": string,"at": string,"details": Json,"id": number,"target": string,"total_count": number
            }[]
                           },
"admin_dashboard":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"id": string,"last_sign_in_at": string,"role": Database["public"]['Enums']["app_role"],"total_count": number
            }[]
                           },
"audit_write":
{ Args: { "p_action": string,"p_actor": string,"p_details": Json,"p_target": string }; Returns: undefined
                           },
"cancel_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: undefined
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"complete_payment_challenge":
{ Args: { "p_order_id": string,"p_success": boolean }; Returns: string
                           },
"issue_refund":
{ Args: { "p_amount": number,"p_order_id": string,"p_reason": string,"p_return_id"?: string }; Returns: string
                           },
"mark_delivered":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"mark_order_paid_external":
{ Args: { "p_order_id": string,"p_provider_ref": string }; Returns: string
                           },
"my_permissions":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"pay_order":
{ Args: { "p_order_id": string,"p_scenario": string }; Returns: string
                           },
"place_order":
{ Args: { "p_address": Json,"p_coupon": string,"p_items": Json,"p_method": string,"p_provider"?: string }; Returns: string
                           },
"quote_cart":
{ Args: { "p_coupon"?: string,"p_items": Json,"p_method"?: string }; Returns: Json
                           },
"receive_return":
{ Args: { "p_return_id": string }; Returns: undefined
                           },
"request_return":
{ Args: { "p_items": Json,"p_order_id": string,"p_reason": string }; Returns: string
                           },
"review_return":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_return_id": string }; Returns: undefined
                           },
"search_products":
{ Args: { "p_category"?: string,"p_in_stock"?: boolean,"p_limit"?: number,"p_max"?: number,"p_min"?: number,"p_offset"?: number,"p_query"?: string,"p_sort"?: string }; Returns: {
              "accent": string,"available": number,"base_price": number,"brand": string,"category_name": string,"category_slug": string,"featured": boolean,"id": string,"image_path": string,"max_price": number,"min_price": number,"name": string,"slug": string,"total_count": number
            }[]
                           },
"set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"ship_order":
{ Args: { "p_carrier": string,"p_order_id": string,"p_tracking"?: string }; Returns: undefined
                           },
"sim_advance":
{ Args: { "p_steps"?: number }; Returns: Json
                           },
"sim_reset":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"sim_set_scenario":
{ Args: { "p_scenario": string }; Returns: undefined
                           },
"store_config":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"track_order":
{ Args: { "p_token": string }; Returns: Json
                           }
          }
          Enums: {
            "app_role": "customer"|"catalog"|"warehouse"|"finance"|"admin","delivery_status": "unfulfilled"|"processing"|"shipped"|"delivered"|"cancelled"|"returned","payment_status": "pending"|"requires_action"|"approved"|"declined"|"timed_out"|"expired"|"voided"|"refunded"|"partially_refunded","return_status": "requested"|"approved"|"rejected"|"received"|"refunded"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["customer", "catalog", "warehouse", "finance", "admin"],"delivery_status": ["unfulfilled", "processing", "shipped", "delivered", "cancelled", "returned"],"payment_status": ["pending", "requires_action", "approved", "declined", "timed_out", "expired", "voided", "refunded", "partially_refunded"],"return_status": ["requested", "approved", "rejected", "received", "refunded"]
          }
        }
} as const
