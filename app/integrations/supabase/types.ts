
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tool_inventory: {
        Row: {
          id: string
          image_url: string
          tools: Json
          bin_name: string
          bin_location: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          image_url: string
          tools?: Json
          bin_name: string
          bin_location: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          tools?: Json
          bin_name?: string
          bin_location?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
