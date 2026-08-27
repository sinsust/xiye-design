# T2-A AnalysisPlan 验证报告

生成时间：2026-08-27T06:30:25.034Z

总计断言：35 · HARD 失败：0 · WARN 失败：0

| 层 | 断言 | 级别 | 结果 | 说明 |
| --- | --- | --- | --- | --- |
| L1-revenue | 生成 revenue_overview 计划 | HARD | ✅ | outputs=3 |
| L1-revenue | 计划含「按国家销售额」聚合 | HARD | ✅ | 国家,销售额 |
| L1-revenue | 执行成功 | HARD | ✅ | results=3 |
| L1-revenue | 国家销售额聚合数值正确 | HARD | ✅ | got=[["US","5709.5"],["CN","3499.5"],["DE","3200.0"],["UK","1050.0"],["JP","990.0"]] |
| L1-revenue | 实际样本量=数据行数 | WARN | ✅ | sample=11/11 |
| L2-product | 生成 product_performance 计划 | HARD | ✅ | outputs=3 |
| L2-product | 含 SKU Top 排名输出 | HARD | ✅ | outputs=prod_top,prod_stock,prod_status |
| L2-product | 执行成功 | HARD | ✅ | results=3 |
| L3-logistics | 生成 logistics_cost 计划 | HARD | ✅ | outputs=3 |
| L3-logistics | 含费用或时效维度 | HARD | ✅ | outputs=各物流渠道费用合计 / 各物流渠道平均签收时效 / 物流状态分布 |
| L3-logistics | 执行成功 | HARD | ✅ | results=3 |
| L3-logistics | 时效均值计算合理(≥0) | WARN | ✅ | [["FedEx","4.5"],["DHL","4.0"],["UPS","3.0"],["SF","0.0"],["EMS","0.0"]] |
| L4-ads | 生成 advertising_performance 计划 | HARD | ✅ | outputs=5 |
| L4-ads | 含派生指标(CTR/CVR/ROI) | HARD | ✅ | outputs=ads_spend,ads_ctr,ads_cvr,ads_roi,ads_trend |
| L4-ads | 执行成功 | HARD | ✅ | results=5 |
| L4-ads | CTR 百分比在 0~100 | WARN | ✅ | [["品牌词","4.2"],["通用词","3.2"],["竞品词","2.2"]] |
| L5-customer | 生成 customer_overview 计划 | HARD | ✅ | outputs=3 |
| L5-customer | 含标签分布与新增趋势 | HARD | ✅ | outputs=cust_tag,cust_trend,cust_detail |
| L5-customer | 执行成功 | HARD | ✅ | results=3 |
| L6-missing | 纯文本表不生成营收假计划 | HARD | ✅ | 缺少金额 / 数值类指标字段（如 销售额、金额、营收）;缺少分组维度字段（如 国家 / 地区 / 品类 / 订单号） |
| L6-missing | 纯文本表不生成商品假计划 | HARD | ✅ | 缺少商品 / SKU 标识字段（如 SKU、商品编码、商品名）;缺少价格 / 成本 / 库存类数值字段（如 售价、成本、库存） |
| L6-missing | list_objectives 正确标注不可用 | WARN | ✅ | available=0 |
| L7-lowconf | 低置信未确认金额不可作为指标 | HARD | ✅ | 缺少金额 / 数值类指标字段（如 销售额、金额、营收） |
| L7-lowconf | 用户确认类型后字段可用 | HARD | ✅ | ok |
| L8-confirmed | 生成计划(已排除退款列) | HARD | ✅ | ok |
| L8-confirmed | 计划字段全部在 confirmed 集合内 | HARD | ✅ | fields=国家,下单日期,销售额 |
| L8-confirmed | 计划未引用被排除的退款状态列 | HARD | ✅ | refs checked |
| L9-invalid | 计划已存入缓存 | HARD | ✅ | store checked |
| L9-invalid | 重确认后旧计划失效 | HARD | ✅ | cleared checked |
| L10-crossuser | 用户B无法读取用户A的表 | HARD | ✅ | 隔离ok |
| L10-crossuser | 用户B无法读取用户A的计划 | HARD | ✅ | 隔离ok |
| L11-expiry | 过期后表缓存不可读 | HARD | ✅ | expired cache checked |
| L11-expiry | 过期后计划不可读 | HARD | ✅ | expired plan checked |
| L11-expiry | 重新上传后可重建计划 | HARD | ✅ | recovery ok |
| L12-offline | generate+execute 纯函数离线完成 | HARD | ✅ | ran offline (no fetch/LLM) |
