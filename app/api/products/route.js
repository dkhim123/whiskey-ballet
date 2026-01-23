/**
 * Product API - CRUD operations with database sync
 */

import { NextResponse } from "next/server"

// In production, replace with actual database
let products = []

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const product = products.find((p) => p.id === id)
      if (product) {
        return NextResponse.json(product)
      }
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Return all products
    return NextResponse.json({
      products,
      count: products.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const product = await request.json()

    // Add server timestamp
    const newProduct = {
      ...product,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    products.push(newProduct)

    return NextResponse.json({
      success: true,
      product: newProduct,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const updatedProduct = await request.json()
    const index = products.findIndex((p) => p.id === updatedProduct.id)

    if (index === -1) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    products[index] = {
      ...updatedProduct,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      product: products[index],
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    const index = products.findIndex((p) => p.id === id)

    if (index === -1) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    products.splice(index, 1)

    return NextResponse.json({
      success: true,
      message: "Product deleted",
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
