# Project Overview

## Problem Statement

The President of a 12-unit apartment in India currently manages maintenance fees, expenses, and repair issues manually (spreadsheets, WhatsApp, paper). This is error-prone, time-consuming, and lacks transparency for residents. When the President changes (every ~2 years), there is no clean handover mechanism.

## Goals

1. Digitize monthly maintenance fee collection with PhonePe UPI payments
2. Give residents full transparency into how funds are collected and spent
3. Streamline maintenance issue reporting and resolution tracking
4. Generate meaningful financial and operational reports
5. Make president handover seamless with role transfer
6. Reduce the president's manual workload significantly

## Users

| Role | Count | Description |
|------|-------|-------------|
| `SUPER_ADMIN` | 1 | System owner / IT person. Manages role transfers and system config |
| `PRESIDENT` | 1 (rotates ~2yr) | Apartment committee president with full management privileges |
| `RESIDENT` | Up to 24 | Owners/tenants of the 12 units (max 2 per unit) |

## Apartment Facts

- **Total Units**: 12
- **Location**: India
- **Primary Payment Method**: PhonePe UPI
- **Login Method**: Google (Gmail) OAuth for all users

## Core Modules

| Module | Primary User | Description |
|--------|-------------|-------------|
| User & Unit Management | Super Admin / President | Manage residents, assign units, handle role transfer |
| Maintenance Fee Tracking | President + Residents | Define fee schedules, record payments, track dues |
| PhonePe Payments | Residents | Pay monthly maintenance online via UPI |
| Expense Management | President | Record expenses, attach receipts, categorize spending |
| Issue Tracker | Residents + President | Raise, assign, track, and close maintenance issues |
| Reports & Analytics | All | Collection status, fund utilization, issue trends |
| Announcements | President → Residents | Post notices (AGM, water shutoff, events) |
| Document Vault | President + Residents | Store meeting minutes, invoices, audit reports |

## Non-Functional Requirements

- **Cost**: 100% free infrastructure (Supabase free tier + Vercel free tier)
- **Open Source**: All dependencies must be open source
- **Security**: Payment-grade security — signed webhooks, RLS, audit logs
- **Mobile-Friendly**: Responsive web app usable on Android phones (no native app needed)
- **Maintainable**: Simple codebase, clear conventions, easy for next president to hand over to a new IT admin
- **Performance**: Fast on low-bandwidth mobile connections in India
