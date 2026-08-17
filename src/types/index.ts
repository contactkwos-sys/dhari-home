export type Manufacturer = 'Jaisal Fashion Weave' | 'Other'

export type Platform =
  | 'Flipkart'
  | 'Amazon'
  | 'Meesho'
  | 'Myntra'
  | 'Website'
  | 'Other'

export type PaymentStatus = 'Prepaid' | 'COD Pending' | 'COD Received'
export type MovementType = 'IN' | 'OUT'

export interface DnoMaster {
  id: string
  dno_number: string
  photo_url: string | null
  size: string
  manufacturer: Manufacturer
  other_manufacturer_name: string | null
  purchase_rate: number | null
  category: string | null
  hsn_code: string | null
  gst_rate: number
  date_added: string
}

export interface StockMovement {
  id: string
  dno_id: string
  type: MovementType
  qty: number
  date: string
  note: string | null
  dno_master?: Pick<DnoMaster, 'dno_number' | 'size'> | null
}

export interface Order {
  id: string
  order_date: string
  dno_id: string
  platform: Platform
  platform_order_id: string | null
  pieces: number
  sale_rate: number
  buyer_name: string | null
  buyer_state: string | null
  courier: string | null
  awb_number: string | null
  payment_status: PaymentStatus
  invoice_no: string | null
  dno_master?: Pick<
    DnoMaster,
    'dno_number' | 'size' | 'hsn_code' | 'gst_rate' | 'category'
  > | null
}

export interface StockRow {
  dno: DnoMaster
  inbound: number
  outbound: number
  balance: number
}

export const PLATFORMS: Platform[] = [
  'Flipkart',
  'Amazon',
  'Meesho',
  'Myntra',
  'Website',
  'Other',
]

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Prepaid',
  'COD Pending',
  'COD Received',
]

export const SIZES = ['5ft x 4ft', '7ft x 4ft'] as const

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]
