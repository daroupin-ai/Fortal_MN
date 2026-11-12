---
name: higgsfield-seedance-prompt
description: Draft or revise text-only Higgsfield Seedance 2.0 prompts for 15-second, multi-shot 2D cel animation. Use for Korean scene planning and the user's `프롬` handoff to an English prompt with Korean dialogue. Do not use for running generations or opening Higgsfield tools.
---

# 힉스필드 Seedance 2.0 프롬프트

영상의 장면 구성과 프롬프트만 작성한다. 이미지나 영상을 생성하지 않고, 자료를 업로드하거나 외부 앱에서 작업을 시작하지 않는다.

## 1. 컷 구성 협의

- 장면 지문을 받으면 한국어로 총 15초의 구성을 제안한다. 창작을 맡기면 짧은 줄거리도 함께 제안한다. 예를 들어 4초 + 4초 + 4초 + 3초로 나눈다.
- 3~4개 컷의 시작·종료 시각, 컷 길이, 화면에서 보이는 행동을 적는다. 한 컷에 핵심 행동 하나와 카메라 구도 또는 움직임 하나를 우선한다.
- 컷 사이에 이어질 인물, 장소, 소품, 빛의 방향과 색을 짚는다. 사용자가 구성을 수정하면 시간 배분과 연결되는 동작도 맞춘다.
- 사용자가 **프롬**이라고 입력하기 전까지는 구성을 협의한다. 구성 없이 **프롬**만 입력했다면 장면 지문을 요청한다.

## 2. 하나의 프롬프트 작성

- 확정한 구성을 영어 프롬프트 하나로 출력한다. 대사만 한글로 쓴다. 첫 줄에 총 15초와 컷 수를 적고, `CUT 1 | 0–4s | 4s`처럼 각 컷의 시간 범위와 길이를 적는다. 화면 비율과 8K 같은 수치 설정은 생략한다.
- 공통 스타일에 `2D Japanese cel animation style, cinematic lighting, high-resolution animation still quality, crisp edges, consistent art style`을 넣는다.
- 컷마다 장소와 구도, 누가 무엇을 하는지, 컷 끝에 화면이 어떤 상태인지 명확히 쓴다. 각 컷을 따로 읽어도 이해되도록 필요한 인물·소품·배경 단서를 짧게 반복한다. 인물 외형을 자세히 새로 설정하지 않는다.
- 같은 인물은 같은 이름으로 부른다. 참조 자료가 있으면 어떤 요소를 유지할지 정하고, 화면에서 확인된 참조 태그가 있으면 그대로 쓴다. 자료나 태그를 임의로 만들지 않는다. `@인물명`은 대사 화자 표기다. 예: `@Traveler: "이제 돌아갈 시간이야."` 발화는 컷 길이에 맞추고, 대사가 없는 구성에는 새로 넣지 않는다.
- 옷감과 머리카락은 실제 동작과 바람 방향에 따라 움직이게 하고, 먼지·연기·비·빛 입자는 장면에 맞게 이동하고 잦아들게 한다. 인물은 비율과 관절 정렬을 유지하고, 무게 이동과 손 모양을 안정적으로 묘사한다. 의도치 않은 몸통 회전이나 팔다리 뭉개짐을 막는 지시를 넣는다.
- 발소리, 옷감 마찰음 같은 폴리와 장면의 효과음을 화면 동작에 맞춰 각 컷에 지정한다. 음악과 대사 자막은 넣지 않는다. 간판 등 화면 속 글자가 요청된 경우에만 원문을 따옴표로 지정하고, 한글과 영어 철자를 그대로 선명하게 표시하도록 지시한다.
- 출력 전에 컷 시간에 빈틈이나 겹침이 없는지, 합계가 15초인지, 참조와 인물 이름이 일치하는지 확인한다.

참고: [힉스필드 Seedance 2.0 공식 프롬프트 가이드](https://higgsfield.ai/blog/seedance-prompting-guide), [공식 참조 자료·카메라 튜토리얼](https://higgsfield.ai/blog/generating-with-seedance-2-0).
