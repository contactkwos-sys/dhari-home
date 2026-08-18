-- Allow IndiaMART marketplace on orders.platform
alter table public.orders
  drop constraint if exists orders_platform_check;

alter table public.orders
  add constraint orders_platform_check
  check (
    platform in (
      'Flipkart',
      'Amazon',
      'IndiaMART',
      'Meesho',
      'Myntra',
      'Website',
      'Other'
    )
  );
