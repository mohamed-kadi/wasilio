export const API_BASE_URL = '/api';

export interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Order {
  id: string;
  tenantId: string;
  status: string;
  customer: Customer;
  address: Address;
  amount: number;
  courierId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const fetchOrders = async (): Promise<Order[]> => {
  const res = await fetch(`${API_BASE_URL}/orders`);
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
};

export const createOrder = async (data: { customer: Customer; address: Address; amount: number }) => {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create order');
  return res.json();
};
