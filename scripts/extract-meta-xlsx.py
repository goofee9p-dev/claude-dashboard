import json
import sys
from pathlib import Path

import openpyxl


def num(value):
    if value in (None, ""):
        return 0
    return float(value)


def main():
    path = Path(sys.argv[1])
    if not path.exists():
        print("[]")
        return

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(cell).strip() if cell is not None else "" for cell in next(rows)]
    index = {name: idx for idx, name in enumerate(header)}
    out = []

    for row in rows:
        if not row or not row[index["캠페인 이름"]]:
            continue
        day = row[index["일"]]
        date = day.isoformat() if hasattr(day, "isoformat") else str(day)[:10]
        out.append({
            "campaign": row[index["캠페인 이름"]] or "",
            "group": row[index["광고 세트 이름"]] or "",
            "creative": row[index["광고 이름"]] or "",
            "date": date,
            "impressions": num(row[index["노출"]]),
            "clicks": num(row[index["링크 클릭"]]),
            "cost": num(row[index["지출 금액 (KRW)"]]),
            "purchases": num(row[index["공유 항목이 포함된 구매"]]),
            "revenue": num(row[index["공유 항목의 구매 전환값"]]),
        })

    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
