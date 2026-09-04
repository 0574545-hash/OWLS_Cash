//  DashboardView.swift
//  Итог месяца и доли категорий кольцами.

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var progress: Double = 0

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Дашборд")
                    .font(OW.display(24))
                    .foregroundStyle(OW.ink)

                LazyVGrid(columns: columns, spacing: 16) {
                    VStack(spacing: 8) {
                        VStack(spacing: 3) {
                            Text("ВСЕГО")
                                .font(OW.body(8.5, .semiBold))
                                .tracking(0.85)
                                .foregroundStyle(.white.opacity(0.55))
                            Text(Fmt.money(store.monthTotal))
                                .font(OW.display(Fmt.money(store.monthTotal).count > 7 ? 12.5 : 15))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text("₽")
                                .font(OW.display(9, .regular))
                                .foregroundStyle(OW.accent)
                        }
                        .frame(width: 104, height: 104)
                        .background(OW.ink)
                        .clipShape(Circle())

                        Text(Fmt.capitalized(Fmt.monthName(Date())))
                            .font(OW.body(11.5, .bold))
                            .foregroundStyle(OW.ink)
                    }

                    ForEach(store.slices) { slice in
                        VStack(spacing: 8) {
                            RingView(slice: slice, progress: progress)
                            Text(slice.name)
                                .font(OW.body(11, .semiBold))
                                .foregroundStyle(OW.ink2)
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                                .frame(maxWidth: 108)
                        }
                    }
                }

                if store.slices.isEmpty {
                    Text("В этом месяце расходов ещё нет. Доли категорий появятся после первой записи.")
                        .font(OW.body(12.5))
                        .foregroundStyle(OW.muted)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 20)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 120)
        }
        .background(OW.bg)
        .onAppear {
            progress = 0
            if reduceMotion {
                progress = 1
            } else {
                withAnimation(.easeInOut(duration: 0.55)) { progress = 1 }
            }
        }
    }
}

struct RingView: View {
    let slice: CategorySlice
    let progress: Double

    var body: some View {
        ZStack {
            Circle()
                .fill(OW.card)
                .overlay(Circle().stroke(OW.stone, lineWidth: 8))
                .padding(4)

            Circle()
                .trim(from: 0, to: slice.share * progress)
                .stroke(slice.color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .padding(4)
                .rotationEffect(.degrees(-90))

            VStack(spacing: 3) {
                Image(systemName: slice.icon)
                    .font(.system(size: 14))
                    .foregroundStyle(OW.ink)
                Text(Fmt.money(slice.total))
                    .font(OW.display(Fmt.money(slice.total).count > 7 ? 11 : 13))
                    .foregroundStyle(OW.ink)
                    .lineLimit(1)
                Text("\(Int((slice.share * 100).rounded()))%")
                    .font(OW.body(9.5, .semiBold))
                    .foregroundStyle(OW.muted)
            }
        }
        .frame(width: 104, height: 104)
    }
}
