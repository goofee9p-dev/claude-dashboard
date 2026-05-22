import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import openpyxl


ROOT = Path(r"C:\Users\user\Documents\Craude Dash board\raw data_media")
OUT_JSON = Path("data/dashboard-data.json")
OUT_JS = Path("data/dashboard-data.js")


def to_number(value):
    if value in (None, ""):
        return 0.0
    text = str(value).replace(",", "").replace(" --", "").strip()
    if text in ("", "-", "--"):
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def normalize_date(value):
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    text = str(value)
    match = re.search(r"(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})", text)
    if not match:
        return ""
    return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"


def read_text(path):
    data = path.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return data.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8-sig", errors="replace"), "utf-8-sig-replace"


def read_csv_table(path):
    text, encoding = read_text(path)
    rows = list(csv.reader(text.splitlines()))
    header_idx = None
    for idx, row in enumerate(rows[:12]):
        labels = set(row)
        joined = "|".join(row)
        if (
            {"캠페인", "광고그룹"}.issubset(labels)
            or "광고 소재 이름" in labels
            or "전환 유형" in labels
            or ("일" in labels and "노출수" in labels)
            or ("일별" in labels and ("노출수" in labels or "총 전환수" in labels))
        ):
            header_idx = idx
            break
    if header_idx is None:
        return [], [], encoding
    header = [h.strip() for h in rows[header_idx]]
    return header, rows[header_idx + 1 :], encoding


def row_dict(header, row):
    return {header[i]: row[i] if i < len(row) else "" for i in range(len(header))}


def clean_promotion_name(value):
    return re.sub(r"\s*(DA|쇼핑프로모션)$", "", str(value or "")).strip()


def format_promo_date(value):
    source = str(value or "")
    match = re.match(r"^26(\d{4})-(?:26)?(\d{4})$", source)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    match = re.match(r"^26(\d{4})-(\d{2})$", source)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    match = re.match(r"^26(\d{4})$", source)
    if match:
        return match.group(1)
    return ""


def with_promo_date(date_token, name):
    date = format_promo_date(date_token)
    return f"{date} {name}" if date else name


def infer_type(campaign, group):
    source = f"{group or ''}_{campaign or ''}"
    if source.startswith("A_"):
        return "상시"
    if source.startswith("P_"):
        return "프로모션"
    if "프로모션" in source:
        return "프로모션"
    return "기타"


def infer_objective(*values):
    source = "_".join(str(v or "") for v in values)
    if "트래픽" in source or "유입" in source or "콘텐츠조회" in source:
        return "트래픽(유입)"
    if "전환" in source or "구매" in source:
        return "전환"
    return "기타"


def infer_promotion(campaign, group, creative, row_type):
    group_parts = [p for p in str(group or "").split("_") if p]
    creative_parts = [p for p in str(creative or "").split("_") if p]
    campaign_parts = [p for p in str(campaign or "").split("_") if p]

    if row_type == "상시":
        for part in group_parts + campaign_parts:
            if re.search(r"카탈로그|ADVoost|애드부스트|스마트채널|네이티브|쇼핑프로모션|DA|검색|파워링크|브랜드", part):
                return clean_promotion_name(part)
        return "상시"

    if len(group_parts) > 3 and group_parts[0] == "P" and re.match(r"^\d", group_parts[1]):
        return with_promo_date(group_parts[1], clean_promotion_name(group_parts[3]))
    if len(creative_parts) > 1 and re.match(r"^\d", creative_parts[0]):
        return with_promo_date(creative_parts[0], clean_promotion_name(creative_parts[1]))
    if len(campaign_parts) > 3:
        return clean_promotion_name("_".join(campaign_parts[3:-1])) or "프로모션"
    return "프로모션"


def infer_channel(campaign, group, creative):
    source = f"{campaign or ''}_{group or ''}_{creative or ''}"
    for candidate in ["쇼핑프로모션", "쇼핑검색", "스마트채널", "네이티브", "카탈로그", "ADVoost 소재", "애드부스트", "디맨드젠", "파워링크", "DA", "피드형", "검색"]:
        if candidate in source:
            return candidate
    return "기타"


def infer_target(campaign, group, creative):
    source = f"{campaign or ''}_{group or ''}_{creative or ''}"
    for candidate in ["고객여정+알림받기타겟", "리타겟+고객여정", "CRM유사타겟", "방문후미액션타겟", "잠재고객", "맞춤타겟", "관심사", "리타겟", "논타겟", "학생타겟"]:
        if candidate in source:
            return candidate
    return "기타"


def infer_theme(creative):
    source = str(creative or "")
    for candidate in ["사은", "할인", "USP", "누끼", "루미프레임", "스퀘어형", "피드형", "배너형", "제품형", "기능성강조"]:
        if candidate in source:
            return candidate
    return "기타"


def enrich_record(record):
    row_type = infer_type(record["campaign"], record["group"])
    record.update(
        {
            "type": row_type,
            "promotion": infer_promotion(record["campaign"], record["group"], record["creative"], row_type),
            "objective": infer_objective(record["campaign"], record["group"], record["creative"]),
            "target": infer_target(record["campaign"], record["group"], record["creative"]),
            "channel": infer_channel(record["campaign"], record["group"], record["creative"]),
            "creativeTheme": infer_theme(record["creative"]),
            "hasHour": False,
            "hour": None,
            "hourLabel": "일 단위",
        }
    )
    return record


def base_record(**kwargs):
    record = {
        "date": "",
        "media": "",
        "account": "",
        "campaign": "",
        "group": "",
        "creative": "",
        "keyword": "",
        "cost": 0,
        "impressions": 0,
        "clicks": 0,
        "purchases": 0,
        "revenue": 0,
        "source": "",
    }
    record.update(kwargs)
    return enrich_record(record)


def parse_gfa():
    records = []
    for path in sorted((ROOT / "naver" / "주식회사 지누스").glob("*.csv")):
        header, rows, _ = read_csv_table(path)
        if not header:
            continue
        for raw in rows:
            row = row_dict(header, raw)
            date = normalize_date(row.get("기간"))
            if not date:
                continue
            records.append(
                base_record(
                    date=date,
                    media="네이버(GFA)",
                    account="주식회사 지누스",
                    campaign=row.get("캠페인 이름", ""),
                    group=row.get("광고 그룹 이름", ""),
                    creative=row.get("광고 소재 이름", ""),
                    cost=to_number(row.get("총비용")),
                    impressions=to_number(row.get("노출수")),
                    clicks=to_number(row.get("클릭수")),
                    purchases=to_number(row.get("구매완료 수")),
                    revenue=to_number(row.get("구매완료 전환매출액")),
                    source=str(path.relative_to(ROOT)),
                )
            )
    return records


def search_key(row):
    return (
        row.get("campaign", ""),
        row.get("group", ""),
        row.get("creative", ""),
        row.get("keyword", ""),
        row.get("date", ""),
    )


def parse_naver_search_account(account_dir, account_name, performance_patterns, conversion_patterns):
    conversions = defaultdict(lambda: {"purchases": 0.0, "revenue": 0.0})
    records = []
    used_conversion_keys = set()

    for path in sorted(account_dir.glob("*.csv")):
        if not any(re.search(pattern, path.name) for pattern in conversion_patterns):
            continue
        header, rows, _ = read_csv_table(path)
        for raw in rows:
            row = row_dict(header, raw)
            if row.get("전환 유형") != "구매완료":
                continue
            date = normalize_date(row.get("일별"))
            key = (row.get("캠페인", ""), row.get("광고그룹", ""), row.get("소재", ""), row.get("키워드", ""), date)
            conversions[key]["purchases"] += to_number(row.get("총 전환수"))
            conversions[key]["revenue"] += to_number(row.get("총 전환매출액(원)"))

    for path in sorted(account_dir.glob("*.csv")):
        if not any(re.search(pattern, path.name) for pattern in performance_patterns):
            continue
        header, rows, _ = read_csv_table(path)
        for raw in rows:
            row = row_dict(header, raw)
            date = normalize_date(row.get("일별"))
            if not date:
                continue
            temp = {
                "campaign": row.get("캠페인", ""),
                "group": row.get("광고그룹", ""),
                "creative": row.get("소재", ""),
                "keyword": row.get("키워드", ""),
                "date": date,
            }
            conv = conversions.get(search_key(temp), {"purchases": 0.0, "revenue": 0.0})
            used_conversion_keys.add(search_key(temp))
            records.append(
                base_record(
                    date=date,
                    media=f"네이버 검색광고({account_name})",
                    account=account_name,
                    campaign=temp["campaign"],
                    group=temp["group"],
                    creative=temp["creative"],
                    keyword=temp["keyword"] if temp["keyword"] != "-" else "",
                    cost=to_number(row.get("총비용")),
                    impressions=to_number(row.get("노출수")),
                    clicks=to_number(row.get("클릭수")),
                    purchases=conv["purchases"],
                    revenue=conv["revenue"],
                    source=str(path.relative_to(ROOT)),
                )
            )

    for key, conv in conversions.items():
        if key in used_conversion_keys:
            continue
        campaign, group, creative, keyword, date = key
        records.append(
            base_record(
                date=date,
                media=f"네이버 검색광고({account_name})",
                account=account_name,
                campaign=campaign,
                group=group,
                creative=creative,
                keyword=keyword if keyword != "-" else "",
                purchases=conv["purchases"],
                revenue=conv["revenue"],
                source=str(account_dir.relative_to(ROOT)),
            )
        )
    return records


def parse_meta():
    records = []
    meta_files = [
        (ROOT / "meta" / "Naver", "메타(네이버협력)", "네이버협력"),
        (ROOT / "meta" / "Ohouse", "메타(오늘의집)", "오늘의집협력"),
        (ROOT / "meta" / "Official", "메타(공홈)", "공홈"),
    ]
    for folder, media, account in meta_files:
        for path in sorted(folder.glob("*.xlsx")):
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue
            header = [str(c).strip() if c is not None else "" for c in rows[0]]
            index = {name: idx for idx, name in enumerate(header)}
            for raw in rows[1:]:
                if not raw or not raw[index.get("캠페인 이름", 0)]:
                    continue
                purchase_col = "공유 항목이 포함된 구매" if "공유 항목이 포함된 구매" in index else "구매"
                revenue_col = "공유 항목의 구매 전환값" if "공유 항목의 구매 전환값" in index else "구매 전환값"
                records.append(
                    base_record(
                        date=normalize_date(raw[index["일"]]),
                        media=media,
                        account=account,
                        campaign=raw[index.get("캠페인 이름", 0)] or "",
                        group=raw[index.get("광고 세트 이름", 0)] or "",
                        creative=raw[index.get("광고 이름", 0)] or "",
                        cost=to_number(raw[index.get("지출 금액 (KRW)", -1)] if "지출 금액 (KRW)" in index else 0),
                        impressions=to_number(raw[index.get("노출", -1)] if "노출" in index else 0),
                        clicks=to_number(raw[index.get("링크 클릭", -1)] if "링크 클릭" in index else 0),
                        purchases=to_number(raw[index.get(purchase_col, -1)] if purchase_col in index else 0),
                        revenue=to_number(raw[index.get(revenue_col, -1)] if revenue_col in index else 0),
                        source=str(path.relative_to(ROOT)),
                    )
                )
    return records


def parse_google():
    records = []
    for path in sorted((ROOT / "google").glob("*.csv")):
        header, rows, _ = read_csv_table(path)
        if not header:
            continue
        for raw in rows:
            row = row_dict(header, raw)
            date = normalize_date(row.get("일"))
            if not date:
                continue
            records.append(
                base_record(
                    date=date,
                    media="구글",
                    account="주간보고 1팀",
                    campaign=row.get("캠페인", ""),
                    group=row.get("광고그룹", ""),
                    creative=row.get("광고 이름", ""),
                    keyword="",
                    cost=to_number(row.get("비용")),
                    impressions=to_number(row.get("노출수")),
                    clicks=to_number(row.get("클릭수")),
                    purchases=to_number(row.get("전환")),
                    revenue=to_number(row.get("전환 가치")),
                    source=str(path.relative_to(ROOT)),
                )
            )
    return records


def empty_metrics():
    return {"cost": 0, "impressions": 0, "clicks": 0, "purchases": 0, "revenue": 0}


def add_metrics(target, row):
    for key in ("cost", "impressions", "clicks", "purchases", "revenue"):
        target[key] += row.get(key, 0) or 0


def enrich_metrics(metrics):
    out = dict(metrics)
    out["ctr"] = out["clicks"] / out["impressions"] if out["impressions"] else 0
    out["cvr"] = out["purchases"] / out["clicks"] if out["clicks"] else 0
    out["roas"] = out["revenue"] / out["cost"] if out["cost"] else 0
    out["cpc"] = out["cost"] / out["clicks"] if out["clicks"] else 0
    out["cpa"] = out["cost"] / out["purchases"] if out["purchases"] else 0
    return out


def aggregate(records, key):
    bucket = defaultdict(empty_metrics)
    for row in records:
        add_metrics(bucket[row.get(key) or "기타"], row)
    return sorted(({"name": name, **enrich_metrics(metrics)} for name, metrics in bucket.items()), key=lambda x: x["revenue"], reverse=True)


def build():
    records = []
    records.extend(parse_gfa())
    records.extend(parse_naver_search_account(ROOT / "naver" / "sypglobal01", "sypglobal01", [r"키워드 보고서"], [r"전환 보고서"]))
    records.extend(parse_naver_search_account(ROOT / "naver" / "zinusinc.naver", "zinusinc.naver", [r"캠페인 보고서"], [r"전환 보고서"]))
    records.extend(parse_meta())
    records.extend(parse_google())
    records = [r for r in records if r.get("date")]

    totals = empty_metrics()
    for row in records:
        add_metrics(totals, row)

    compact_records = aggregate_compact_records(records)
    keyword_records = aggregate_keyword_records(records)

    output = {
        "generatedAt": datetime.now().isoformat(),
        "source": str(ROOT),
        "rowCount": len(records),
        "activeRowCount": len([r for r in records if r["cost"] or r["impressions"] or r["clicks"] or r["purchases"] or r["revenue"]]),
        "dimensions": {
            "media": len({r["media"] for r in records}),
            "campaigns": len({r["campaign"] for r in records}),
            "groups": len({r["group"] for r in records}),
            "creatives": len({r["creative"] for r in records}),
            "promotions": len({r["promotion"] for r in records}),
            "dates": len({r["date"] for r in records}),
        },
        "totals": enrich_metrics(totals),
        "dateSeries": aggregate(records, "date"),
        "campaigns": aggregate(records, "campaign"),
        "groups": aggregate(records, "group")[:160],
        "creatives": aggregate(records, "creative")[:200],
        "promotions": aggregate(records, "promotion"),
        "objectives": aggregate(records, "objective"),
        "targets": aggregate(records, "target"),
        "channels": aggregate(records, "channel"),
        "media": aggregate(records, "media"),
        "types": aggregate(records, "type"),
        "creativeThemes": aggregate(records, "creativeTheme"),
        "records": compact_records,
        "keywordRecords": keyword_records,
        "rawRowCount": len(records),
    }
    output["dateSeries"] = sorted(output["dateSeries"], key=lambda x: x["name"])

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(output, ensure_ascii=False, separators=(",", ":"))
    OUT_JSON.write_text(text, encoding="utf-8")
    OUT_JS.write_text(f"window.DASHBOARD_DATA = {text};\n", encoding="utf-8")
    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_JS}")


def aggregate_compact_records(records):
    dimensions = [
        "date",
        "media",
        "account",
        "campaign",
        "group",
        "promotion",
        "objective",
        "target",
        "channel",
        "creativeTheme",
        "type",
    ]
    bucket = {}
    for row in records:
        key = tuple(row.get(dim, "") for dim in dimensions)
        if key not in bucket:
            bucket[key] = {dim: row.get(dim, "") for dim in dimensions}
            bucket[key]["creative"] = ""
            bucket[key]["keyword"] = ""
            bucket[key].update(empty_metrics())
            bucket[key]["hasHour"] = False
            bucket[key]["hour"] = None
            bucket[key]["hourLabel"] = "일 단위"
        add_metrics(bucket[key], row)
    return list(bucket.values())


def aggregate_keyword_records(records):
    dimensions = [
        "date",
        "media",
        "account",
        "campaign",
        "group",
        "channel",
        "promotion",
        "objective",
        "target",
        "keyword",
    ]
    bucket = {}
    for row in records:
        if not row.get("keyword"):
            continue
        key = tuple(row.get(dim, "") for dim in dimensions)
        if key not in bucket:
            bucket[key] = {dim: row.get(dim, "") for dim in dimensions}
            bucket[key]["creative"] = ""
            bucket[key]["creativeTheme"] = ""
            bucket[key]["type"] = row.get("type", "")
            bucket[key].update(empty_metrics())
            bucket[key]["hasHour"] = False
            bucket[key]["hour"] = None
            bucket[key]["hourLabel"] = "일 단위"
        add_metrics(bucket[key], row)
    return list(bucket.values())


if __name__ == "__main__":
    build()
