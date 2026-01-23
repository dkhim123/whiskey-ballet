/**
 * Transaction API - Records all sales
 */

import { NextResponse } from "next/server"

let transactions = []

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let filtered = transactions

    // Filter by user (cashier or admin)
    if (userId) {
      filtered = filtered.filter((t) => t.userId === userId)
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter((t) => new Date(t.date) >= new Date(startDate))
    }
    if (endDate) {
      filtered = filtered.filter((t) => new Date(t.date) <= new Date(endDate))
    }

    return NextResponse.json({
      transactions: filtered,
      count: filtered.length,
      total: filtered.reduce((sum, t) => sum + t.total, 0),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const transaction = await request.json()

    const newTransaction = {
      ...transaction,
      createdAt: new Date().toISOString(),
    }

    transactions.push(newTransaction)

    return NextResponse.json({
      success: true,
      transaction: newTransaction,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
