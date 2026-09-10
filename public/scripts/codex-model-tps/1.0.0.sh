#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
用法：codex-model-tps [选项]

按模型统计本地 Codex 会话的端到端输出 TPS。

选项：
  --hours HOURS      窗口长度（小时），默认 24
  --since TIME       窗口起点（ISO 8601），覆盖 --hours
  --until TIME       窗口终点（ISO 8601），默认当前时间
  --codex-home DIR   Codex 数据目录，默认 $CODEX_HOME 或 ~/.codex
  --group TYPE       session（默认）或 turn
  --model NAME       仅统计精确匹配的模型，可重复指定
  --details          显示样本明细
  -h, --help         显示帮助

TIME 支持 Z 或 +08:00 等明确时区；不带时区时按 UTC 解释。
EOF
}

hours=24
since=
until=
codex_home=${CODEX_HOME:-"$HOME/.codex"}
group=session
models=
details=0

while [ "$#" -gt 0 ]; do
  case $1 in
    --hours|--since|--until|--codex-home|--group|--model)
      option=$1
      [ "$#" -ge 2 ] || { echo "错误：$option 缺少参数" >&2; exit 2; }
      value=$2
      shift 2
      case $option in
        --hours) hours=$value ;;
        --since) since=$value ;;
        --until) until=$value ;;
        --codex-home) codex_home=$value ;;
        --group) group=$value ;;
        --model) models=${models}${models:+,}$value ;;
      esac
      ;;
    --details) details=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "错误：未知选项 $1" >&2; usage >&2; exit 2 ;;
  esac
done

case $group in
  session|turn) ;;
  *) echo "错误：--group 必须是 session 或 turn" >&2; exit 2 ;;
esac

case $codex_home in
  '~') codex_home=$HOME ;;
  '~/'*) codex_home=$HOME/${codex_home#\~/} ;;
esac

command -v awk >/dev/null 2>&1 || { echo "错误：需要 awk" >&2; exit 1; }
command -v find >/dev/null 2>&1 || { echo "错误：需要 find" >&2; exit 1; }

if [ -z "$until" ]; then
  until=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
fi

tmp_base=${TMPDIR:-/tmp}/codex-model-tps.$$
files_file=$tmp_base.files
trap 'rm -f "$files_file"' EXIT HUP INT TERM
: >"$files_file"

for directory in "$codex_home/sessions" "$codex_home/archived_sessions"; do
  if [ -d "$directory" ]; then
    find "$directory" -type f -name '*.jsonl' -print >>"$files_file"
  fi
done

if [ ! -s "$files_file" ]; then
  echo "未找到日志：$codex_home/sessions 或 $codex_home/archived_sessions" >&2
  exit 1
fi

{
  LC_ALL=C sort -u "$files_file" | while IFS= read -r file; do
    [ -n "$file" ] || continue
    printf '\034FILE\034%s\n' "$file"
    if ! sed -n 'p' "$file"; then
      printf '\034READ_ERROR\034%s\n' "$file"
    fi
  done
} | awk -v home="$codex_home" -v since_text="$since" -v until_text="$until" \
  -v hours_text="$hours" -v group_by="$group" -v model_csv="$models" \
  -v show_details="$details" '
function fail(message) { print "错误：" message > "/dev/stderr"; exit_status=2; exit 2 }
function leap(y) { return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 }
function dim(y, m) {
  if (m == 2) return 28 + leap(y)
  return (m == 4 || m == 6 || m == 9 || m == 11) ? 30 : 31
}
function epoch(value,    y,m,d,h,mi,se,suffix,sign,oh,om,offset,days,i) {
  if (value !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][T ][0-9][0-9]:[0-9][0-9]:[0-9][0-9]/) return -1
  y=substr(value,1,4)+0; m=substr(value,6,2)+0; d=substr(value,9,2)+0
  h=substr(value,12,2)+0; mi=substr(value,15,2)+0; se=substr(value,18,2)+0
  if (y < 1970 || m < 1 || m > 12 || d < 1 || d > dim(y,m) || h > 23 || mi > 59 || se > 60) return -1
  suffix=substr(value,20)
  sub(/^\.[0-9]+/, "", suffix)
  offset=0
  if (suffix == "" || suffix == "Z" || suffix == "z") {
    offset=0
  } else if (suffix ~ /^[+-][0-9][0-9]:[0-9][0-9]$/) {
    sign=substr(suffix,1,1)=="-" ? -1 : 1
    oh=substr(suffix,2,2)+0; om=substr(suffix,5,2)+0
    if (oh > 23 || om > 59) return -1
    offset=sign*(oh*3600+om*60)
  } else return -1
  days=0
  for (i=1970; i<y; i++) days += 365 + leap(i)
  for (i=1; i<m; i++) days += dim(y,i)
  days += d-1
  return days*86400+h*3600+mi*60+se-offset
}
function json_string(text, key,    rest,p,i,c,out,esc) {
  rest=text
  p=match(rest, "\\\"" key "\\\"[ \t]*:[ \t]*\\\"")
  if (!p) return ""
  rest=substr(rest, RSTART+RLENGTH)
  out=""; esc=0
  for (i=1; i<=length(rest); i++) {
    c=substr(rest,i,1)
    if (esc) {
      if (c=="n") out=out "\n"; else if (c=="r") out=out "\r"; else if (c=="t") out=out "\t"; else out=out c
      esc=0
    } else if (c=="\\") esc=1
    else if (c=="\"") return out
    else out=out c
  }
  return ""
}
function json_number_after(text, object_key, number_key,    p,rest,pattern,value) {
  p=index(text, "\"" object_key "\"")
  if (!p) return -1
  rest=substr(text,p)
  pattern="\\\"" number_key "\\\"[ \t]*:[ \t]*[0-9]+"
  if (!match(rest,pattern)) return -1
  value=substr(rest,RSTART,RLENGTH)
  sub(/^.*:[ \t]*/,"",value)
  return value+0
}
function relative(path) { return index(path,home "/")==1 ? substr(path,length(home)+2) : path }
function percentile(model,p,    n,pos,lo,hi,fraction) {
  n=sample_count[model]; pos=(n-1)*p/100+1; lo=int(pos); hi=(pos==lo?lo:lo+1); fraction=pos-lo
  return sample[model SUBSEP lo]+(sample[model SUBSEP hi]-sample[model SUBSEP lo])*fraction
}
function sort_samples(model,    n,i,j,value,value_key) {
  n=sample_count[model]
  for (i=2;i<=n;i++) { value=sample[model SUBSEP i]; value_key=sample_key[model SUBSEP i]; j=i-1; while(j>=1 && sample[model SUBSEP j]>value){sample[model SUBSEP (j+1)]=sample[model SUBSEP j];sample_key[model SUBSEP (j+1)]=sample_key[model SUBSEP j];j--} sample[model SUBSEP (j+1)]=value;sample_key[model SUBSEP (j+1)]=value_key }
}
function selected(model,    i,n,parts) {
  if (model_csv=="") return 1
  n=split(model_csv,parts,",")
  for(i=1;i<=n;i++) if(parts[i]==model) return 1
  return 0
}
BEGIN {
  until_epoch=epoch(until_text); if(until_epoch<0) fail("--until 不是有效的 ISO 8601 时间")
  if(hours_text !~ /^[0-9]+([.][0-9]+)?$/ || hours_text+0<=0) fail("--hours 必须为正数")
  if(since_text=="") { since_epoch=until_epoch-hours_text*3600; since_label="按 --hours 计算" }
  else { since_epoch=epoch(since_text); since_label=since_text; if(since_epoch<0) fail("--since 不是有效的 ISO 8601 时间") }
  if(since_epoch>=until_epoch) fail("窗口起点必须早于终点")
}
/^\034FILE\034/ {
  if(active) incomplete++
  current_file=substr($0,7); session=relative(current_file); previous=-1; model="unknown"; active=0; files++
  next
}
/^\034READ_ERROR\034/ { read_errors++; next }
{
  outer_type=json_string($0,"type")
  payload_pos=index($0,"\"payload\"")
  if(outer_type=="" || !payload_pos) { bad_lines++; if(active) bad=1; next }
  payload=substr($0,payload_pos)
  if(outer_type=="session_meta") { value=json_string(payload,"id"); if(value!="") session=value; next }
  if(outer_type=="turn_context") { value=json_string(payload,"model"); if(value!=""){model=value;if(active) active_model=model}; next }
  if(outer_type!="event_msg") next
  event=json_string(payload,"type")
  if(event=="task_started") {
    starts++; if(active) incomplete++
    start=epoch(json_string($0,"timestamp")); if(start<0){bad_boundaries++;active=0;next}
    active=1; turn_id=json_string(payload,"turn_id"); active_model=model; tokens=0; usage=0; bad=0; next
  }
  if(event=="token_count") {
    total=json_number_after(payload,"total_token_usage","output_tokens")
    last=json_number_after(payload,"last_token_usage","output_tokens")
    if(total<0){if(active)bad=1;previous=-1;next}
    if(previous<0) delta=last
    else if(total<previous){delta=-1;counter_resets++}
    else delta=total-previous
    previous=total
    if(active){if(delta<0){bad=1;previous=-1}else{tokens+=delta;usage=1}}
    next
  }
  if(event=="task_complete") {
    completions++; if(!active)next
    active=0; end_id=json_string(payload,"turn_id")
    if(turn_id!="" && end_id!="" && turn_id!=end_id){id_mismatches++;next}
    finish=epoch(json_string($0,"timestamp")); if(finish<0){bad_boundaries++;next}
    if(start<since_epoch || finish>until_epoch){outside++;next}
    seconds=finish-start
    if(bad || !usage || seconds<=0){invalid++;next}
    key=turn_id!="" ? "turn:" turn_id : "time:" session ":" start ":" finish
    if(seen[key]){duplicates++;next}; seen[key]=1
    turn_total++; t_session[turn_total]=session; t_id[turn_total]=(turn_id!=""?turn_id:start); t_model[turn_total]=active_model; t_tokens[turn_total]=tokens; t_seconds[turn_total]=seconds
    available[active_model]=1
    next
  }
  if(event=="task_aborted" || event=="turn_aborted"){if(active)incomplete++;active=0}
}
END {
  if(active) incomplete++
  if(exit_status) exit exit_status
  print "日志目录  : " home
  print "窗口 UTC  : " since_label " ~ " until_text
  print "扫描文件  : " files
  print "统计口径  : 输出 token / 完整轮次端到端耗时"
  if(turn_total==0){print "\n没有找到符合条件的完整轮次。"; diagnostics=1}
  for(i=1;i<=turn_total;i++) if(selected(t_model[i])) {
    chosen++; chosen_sessions[t_session[i]]=1; chosen_models[t_model[i]]=1; total_tokens+=t_tokens[i]; total_seconds+=t_seconds[i]
    model_tokens[t_model[i]]+=t_tokens[i]; model_seconds[t_model[i]]+=t_seconds[i]; model_turns[t_model[i]]++; model_sessions[t_model[i] SUBSEP t_session[i]]=1
    if(group_by=="session") { k=t_model[i] SUBSEP t_session[i]; row_tokens[k]+=t_tokens[i]; row_seconds[k]+=t_seconds[i]; row_turns[k]++; row_label[k]=t_session[i]; row_model[k]=t_model[i] }
    else { k="turn" SUBSEP i; row_tokens[k]=t_tokens[i];row_seconds[k]=t_seconds[i];row_turns[k]=1;row_label[k]=t_session[i] "/" t_id[i];row_model[k]=t_model[i] }
  }
  if(model_csv!="") print "模型筛选  : " model_csv
  if(turn_total>0 && chosen==0){print "\n没有匹配指定模型的有效轮次。";diagnostics=1}
  if(diagnostics){print_diag();exit 2}
  for(s in chosen_sessions) session_count++
  for(m in chosen_models) model_count++
  print "有效会话  : " session_count
  print "有效轮次  : " chosen
  print "模型数量  : " model_count
  print "样本单位  : " (group_by=="session"?"会话 × 模型":"轮次")
  printf "输出 token: %d\n",total_tokens
  printf "执行耗时和: %.2f 秒（%.2f 小时）\n",total_seconds,total_seconds/3600
  printf "整体加权 TPS: %.2f token/s\n",total_tokens/total_seconds
  for(k in row_model){m=row_model[k];n=++sample_count[m];sample[m SUBSEP n]=row_tokens[k]/row_seconds[k];sample_key[m SUBSEP n]=k}
  for(m in chosen_models) sort_samples(m)
  nmodels=0;for(m in chosen_models)model_names[++nmodels]=m
  for(i=2;i<=nmodels;i++){v=model_names[i];j=i-1;while(j>=1&&model_names[j]>v){model_names[j+1]=model_names[j];j--}model_names[j+1]=v}
  print "\n================================================================"
  print "模型对比汇总（TPS 单位：token/s）"
  printf "%-32s %5s %6s %10s %9s %9s %9s %9s\n","Model","N","Turns","Weighted","P50","P90","P95","P99"
  for(i=1;i<=nmodels;i++){m=model_names[i];printf "%-32s %5d %6d %10.2f %9.2f %9.2f %9.2f %9.2f\n",m,sample_count[m],model_turns[m],model_tokens[m]/model_seconds[m],percentile(m,50),percentile(m,90),percentile(m,95),percentile(m,99)}
  if(show_details){print "\n       TPS      Tokens     Seconds  Turns  Session[/Turn]";for(i=1;i<=nmodels;i++){m=model_names[i];for(j=1;j<=sample_count[m];j++){k=sample_key[m SUBSEP j];printf "%10.2f  %10d  %10.2f  %5d  %s\n",row_tokens[k]/row_seconds[k],row_tokens[k],row_seconds[k],row_turns[k],row_label[k]}}}
  print_diag()
}
function print_diag() {
  print "\n全量扫描诊断（不限定统计窗口，也不限定模型筛选）："
  printf "损坏行=%d, 读取失败=%d, 异常时间边界=%d, 计数回退=%d, 中断/未闭合轮次=%d, 窗口外轮次=%d, 轮次ID不匹配=%d, 窗口内无效轮次=%d, 重复轮次=%d\n",bad_lines,read_errors,bad_boundaries,counter_resets,incomplete,outside,id_mismatches,invalid,duplicates
}
'
