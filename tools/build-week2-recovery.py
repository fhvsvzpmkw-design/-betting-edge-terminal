import json,datetime,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]; base=root/'data/walters/nfl/2026/week-02-weekly-evidence'
old=json.load(open(base/'2026-09-22-cle-tb-complete-role-estimates.json'))
registry=json.load(open(root/'data/walters/nfl/player-values/player-values-2026-v1.json'))['players']
personnel=json.loads(subprocess.check_output(['git','cat-file','blob',old['inputBlobs']['data/walters/nfl/2026/week-02-personnel-ledger.json']],cwd=root))
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
b={k:old[k] for k in ['schema','season','sourceWeek','marketViewed','inputCommit','inputBlobs']};b.update(recordedAt=now,estimationPolicy='graham-historical-value-estimates-v1',sources=[],games=[],valueEstimates=[])
def source(id,url,finding,key,kind='OFFICIAL'):
 b['sources'].append(dict(id=id,url=url,finding=finding,gameKeys=[key],kind=kind,checkedAt=now));return id
def who(name):
 norm=lambda x:re.sub('[^a-z0-9]','',x.lower())
 rows=[p for p in registry if norm(p['player'])==norm(name)]
 if not rows and 'supplemental' in globals():
  cap=json.load(open(root/'data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json'))
  found=[p for p in cap['playersAbsentFromLockedRegistry'] if norm(p['fullName'])==norm(name)]
  if len(found)==1: return supplemental(found[0]['fullName'])
 if not rows: rows=[dict(player=p['player'],eaPlayerId=p['identity']) for p in b['valueEstimates'] if p['player']==name]
 if name=='Marcus Harris' and len(rows)>1: rows=[p for p in rows if str(p['eaPlayerId'])=='15311'] # TEN cornerback, not KC defensive tackle.
 if len(rows)!=1: raise ValueError((name,len(rows)))
 return dict(player=rows[0]['player'],eaPlayerId=str(rows[0]['eaPlayerId']))
def team(abbr,sources):return dict(team=abbr,coverage='FINAL_GAME_DAY',allAbsencesReviewed=True,coverageRationale='Reconciled pregame inactive list, retained reserve transactions, current depth roles against game-specific reporting, and postgame injury observations. Camp exclusions and assumptions remain explicit.',sourceIds=sources,qbAvailability=dict(state='NO_GAME_DAY_LOSS',rationale='Starting quarterback completed the reported game duties; reviewed recaps report no injury-related quarterback substitution.',sourceIds=sources),cases=[],coverageExclusions=[],clusterReviews=[],topReceiverClusterReviewed=True)
def case(t,name,sources,status='IR',reps=None,role=None,identity=None):
 p=identity or who(name);arch=[x for x in personnel['currentCases'].values() if x['team']==t['team'] and x['player']==name]
 c=dict(**p,caseKey=arch[0]['caseKey'] if arch else '2026-W02-'+t['team']+'-'+re.sub('[^A-Za-z0-9]+','-',name),newlyIdentified=not bool(arch),availabilityStatus=status,sourceIds=sources,rationale='Historical game-day absence or participation assessment supported by the cited coverage.')
 if reps is None:c.update(resolution='ZERO_CALIBRATED_LOSS',estimateAcknowledged=True,assumptionRationale='Frozen healthy value is zero and non-QB replacement values are nonnegative; no missing player value is treated as zero.')
 else:c.update(resolution='PRIMARY_REPLACEMENT' if len(reps)==1 else 'EQUAL_SHARE_COMMITTEE',modelId='graham-replacement-role-estimate-v1',estimateAcknowledged=True,assumptionRationale=role,baselineTreatment='ADDITIONAL_DUTIES_ONLY',baselineDutiesDisplaced=False,baselineRationale='Value only additional duties in this vacancy; preserve existing baseline duties. This is an explicit role allocation estimate, not measured snap share.',baselineSourceIds=sources,baselineDoubleCountReviewed=True,roleRationale=role,roleSourceIds=sources,primaryEvidence='DOCUMENTED_DEPTH_ESTIMATE',replacements=[who(n) for n in reps])
 t['cases'].append(c);return c
def exclude(t,name,category,sources,why):
 e=dict(player=name,category=category,sourceIds=sources,rationale=why)
 if category=='CAMP_ROSTER_ONLY':e.update(estimateAcknowledged=True,establishedRegularSeasonRole=False,assumptionRationale=why)
 t['coverageExclusions'].append(e)
def cluster(t,g,sources,why):t['clusterReviews'].append(dict(group=g,method='ADDITIVE_NO_EXTRA_MULTIPLIER_ESTIMATE',estimateAcknowledged=True,disjointRolesReviewed=True,rationale=why,sourceIds=sources))
def exposure(c,sources,startlo,starthi,endlo=3600,endhi=3600,duration=3600):
 c['replacementResolution']=c['resolution'];c['resolution']='PARTIAL_TIME_EXPOSURE';c['availabilityStatus']='PARTIAL_GAME';c['exposure']=dict(modelId='graham-historical-time-exposure-v1',estimateAcknowledged=True,assumptionRationale='Use midpoint of reported time bounds; elapsed game time approximates unavailable duties, not snap share.',activeEffectivenessConvention='NORMAL_WHILE_ACTIVE_ESTIMATE',gameDurationSeconds=duration,durationSourceIds=sources,unavailableIntervals=[dict(startEarliest=startlo,startLatest=starthi,endEarliest=endlo,endLatest=endhi,rationale='Bounds follow reported injury quarter and return/no-return status.',sourceIds=sources)])
k='2026-W02-DET-BUF'
ds=[source('det-tx','https://www.detroitlions.com/team/transactions/','Retained reserve transactions and pregame releases including Trayveon Williams; Mays, Branch and Joseph unavailable.',k),source('det-final','https://www.detroitlions.com/news/inactives-lions-vs-bills-miller-mahogany-rakestraw','Miller and Mahogany inactive; Reed and Izien active. Other listed scratches are separated.',k),source('det-post','https://www.detroitlions.com/news/detroit-lions-week-2-observations-stbrown-hutchinson-gibbs','Borom, Bartch and Scruggs replaced Miller, Mahogany and Mays. Goff completed reported passing duties.',k),source('det-depth','https://www.detroitlions.com/team/depth-chart','Depth lists Gibbs/Vaki/Saylors, Clark/Maddox safety roles, Derrick Moore edge and Conklin tight end. Retrospective depth is reconciled with Week 2 availability; not asserted as a dated gamebook.',k)]
bs=[source('buf-tx','https://www.buffalobills.com/team/transactions/2026','Reserve Shavers, Durant and suspended Mathis; retained roster review.',k),source('buf-final','https://www.buffalobills.com/news/buffalo-bills-inactives-vs-lions-week-2','Ty Johnson, Oliver, Sanders inactive. Bishop active; Gore Jr and Dortch elevated.',k),source('buf-post','https://www.buffalobills.com/news/injury-updates-following-tnf-deone-walker-s-steady-play-and-bills-using-upcoming-rest-to-their-advantage','Oliver injured pregame; Walker absorbed extra duties, Danna activated; Moore exited in Q2 and did not return. Final 41–31 in regulation.',k),source('buf-depth','https://www.buffalobills.com/team/depth-chart','Depth shows distinct Sanders/Jackson DL role and active receiving alternatives. Bell inactive and excluded from Moore relief candidates.',k)]
det=team('DET',ds);buf=team('BUF',bs)
case(det,'Isiah Pacheco',ds,reps=['Jahmyr Gibbs','Sione Vaki','Jacob Saylors'],role='Updated available backfield committee; removed released Trayveon Williams. Equal allocation of additional duties is assumed.')
case(det,'Brian Branch',ds,reps=['Chuck Clark'],role='Source-listed starting safety Clark assigned Branch vacancy; Joseph vacancy separately assigned Maddox. Position interchangeability is an estimate.')
case(det,'Kerby Joseph',ds,reps=['Avonte Maddox'],role='Source-listed other starting safety Maddox assigned Joseph vacancy; no duplicated replacement credit.')
for n in ['Giovanni Manu','Damone Clark','Raheem Blackshear','Cedrick Wilson Jr','Kendrick Law']:case(det,n,ds)
for n,r in [('Cade Mays','Juice Scruggs'),('Blake Miller','Larry Borom'),('Christian Mahogany','Ben Bartch')]:case(det,n,ds,status='IR' if n=='Cade Mays' else 'OUT',reps=[r],role='Official postgame report identifies this actual vacant line assignment and replacement.')
case(det,'Payton Turner',ds,reps=['Derrick Moore'],role='Reserve edge vacancy assigned available source-listed edge relief Moore. Additional rotational duties assumed; no incumbent role vacated.')
for n in ['Aidan Keanaaina','Miles Kitselman']:exclude(det,n,'CAMP_ROSTER_ONLY',ds,'Rookie camp reserve before first regular-season roster, absent from established depth roles; assume no established regular-season duty in healthy baseline. Not a missing value set to zero.')
for n in ['Keith Abney II','Ennis Rakestraw Jr.','Jimmy Rolder','Mekhi Wingo','Ahmed Hassanein']:exclude(det,n,'HEALTHY_SCRATCH',ds,'Final inactive/depth reconciliation: no injury designation establishing a lost game-day role.')
exclude(det,'Trayveon Williams','RELEASED_BEFORE_GAME',ds,'Released August 30; removed from earlier replacement committee.')
f=source('firkser-rating','https://www.maddenratings.com/anthony-firkser','Independent Madden 27 page explicitly lists rating unavailable; absent from frozen registry and official supplement.',k,'REPORTING')
b['valueEstimates'].append(dict(player='Anthony Firkser',identity='estimate:anthony-firkser',position='TE',method='POSITION_GROUP_MEDIAN',estimateAcknowledged=True,rationale='Retained veteran IR identity receives disclosed receiver-group prior rather than an invented EA rating.',gameKeys=[k],sourceIds=[f],roleSourceIds=ds,officialAndIndependentSearchCompleted=True,searchFinding='Absent from pinned registry and bound official EA capture; independent player page says rating unavailable.'))
case(det,'Anthony Firkser',ds,reps=['Tyler Conklin'],role='Available depth tight end takes reserve tight-end duties; imputed healthy value remains explicit.',identity={'player':'Anthony Firkser','eaPlayerId':'estimate:anthony-firkser'})
cluster(det,'DEFENSIVE_BACK',ds,'Two separate safety vacancies allocated to two distinct safety occupants; additive no-extra-interaction estimate.')
cluster(det,'OFFENSIVE_LINE',ds,'Three distinct vacant positions with three named actual occupants; additive loss convention with no extra multiplier.')
for n in ['Tyrell Shavers','Zane Durant','Phidarian Mathis']:case(buf,n,bs)
case(buf,'Ty Johnson',bs,status='OUT',reps=['Frank Gore Jr'],role='Elevated active reserve back assigned Johnson reserve duties; existing Cook/Davis baseline maintained.')
case(buf,'Ed Oliver',bs,status='OUT',reps=['Deone Walker'],role='Coach explicitly states Walker took additional duties after Oliver was lost in warmups; additional-duty value only.')
case(buf,'T.J. Sanders',bs,status='OUT',reps=['Landon Jackson'],role='Distinct defensive-line depth role lists Jackson behind Sanders; separate from Walker additional duties for Oliver.')
c=case(buf,'DJ Moore',bs,status='PARTIAL_GAME',reps=['Keon Coleman','Joshua Palmer','Khalil Shakir'],role='Available receiving committee absorbs Moore receiving duties; Bell inactive. Equal additional-duty allocation assumed.');exposure(c,bs,900,1800)
for n in ['Skyler Bell','Jalon Kilgore',"Ar'maj Reed-Adams",'Jude Bowry']:exclude(buf,n,'HEALTHY_SCRATCH',bs,'Final inactive list; no identified injury-related loss.')
b['games'].append(dict(gameKey=k,away='DET',home='BUF',state='READY',teams=[det,buf]))
def impute(t,name,pos,reps,sources,url):
 id='estimate:'+re.sub('[^a-z0-9]+','-',name.lower()).strip('-')
 sid=source(id+'-search',url,'Independent identity page checked; no usable verified rating recovered. Pinned registry and official EA missing-player capture also checked.',k,'REPORTING')
 b['valueEstimates'].append(dict(player=name,identity=id,position=pos,method='POSITION_GROUP_MEDIAN',estimateAcknowledged=True,rationale='Retained missing identity receives a disclosed position-group prior; actual role assessed separately.',gameKeys=[k],sourceIds=[sid],roleSourceIds=sources,officialAndIndependentSearchCompleted=True,searchFinding='No exact identity in frozen registry or official supplement and no verified independent Madden 27 rating recovered.'))
 return case(t,name,sources,reps=reps,role='Source-listed available reserve in the same documented position group supplies additional reserve duties. Broad value prior is explicit.',identity=dict(player=name,eaPlayerId=id))
k='2026-W02-JAX-DEN'
js=[source('jax-tx','https://www.jaguars.com/team/transactions/2026','Green, Mekari, Mustipher and other reserve transactions; Keith Taylor placed on IR June 4, no subsequent release found in the reviewed transaction record.',k),source('jax-roster','https://www.jaguars.com/team/players-roster/','Retained reserve list additionally names Jared Bartlett; reviewed with dated transactions.',k),source('jax-depth','https://www.jaguars.com/team/depth-chart','Mekari vacancy at guard covered by Cleveland/Pregnon alignment; Regis behind Hamilton; reserve linebacker and cornerback identities.',k),source('jax-post','https://www.jaguars.com/news/game-report-2026-week-2-broncos-20-jaguars-13','Hamilton left with back injury in Q4 and returned; full inactive inventory and completed Lawrence duties. Final 20–13 in regulation.',k)]
ns=[source('den-tx','https://www.denverbroncos.com/team/transactions/2026','Drew Sanders waived September 8; Bailey and Deiter injury transactions; Gargiulo, Crum and Lohner reserves.',k),source('den-roster','https://www.denverbroncos.com/team/players-roster/','Retained reserve list includes Bailey, Deiter, Henningsen, Crum, Lohner and Gargiulo.',k),source('den-depth','https://www.denverbroncos.com/team/depth-chart/','Available running-back and receiver roles and linebacker reserve identities.',k),source('den-final','https://www.denverbroncos.com/news/rb-rj-harvey-among-broncos-inactives-for-week-2-game-vs-jaguars','Harvey and Mims inactive injured; Badie/Humphrey active; other inactive identities separated.',k),source('den-snaps','https://www.milehighreport.com/denver-broncos-analysis/186017/denver-broncos-vs-jacksonville-jaguars-snap-counts-and-analysis','Nix played every offensive snap. Meinerz missed two snaps, Palczewski also played two as sixth lineman; no injury cause established by this report. Dobbins/Coleman/Badie participated; Abrams-Draine handled punt returns.',k,'REPORTING')]
jax=team('JAX',js);den=team('DEN',ns)
for n in ['BJ Green II','Sam Mustipher','Zach Durfee','Parker Hughes','Garrett DiGiorgio']:case(jax,n,js)
case(jax,'Patrick Mekari',js,reps=['Emmanuel Pregnon'],role='Mekari right-guard vacancy reconciled with Cleveland at RG and incoming Pregnon at LG; retained Cleveland value is preserved rather than added as free relief credit. Incoming value equals Mekari value, so loss is zero.')
# Convert this two-position move into the existing single-vacancy chain.
c=jax['cases'][-1];c.update(resolution='RECONCILED_ROLE_CHAIN',modelId='graham-reconciled-role-chain-v1',baselineTreatment='RECONCILED_ROLE_CHAIN',baselineDutiesDisplaced=True)
def assignment(role,name,after=False):
 x=dict(role=role,**who(name),rationale='Guard assignment reconciled from healthy positional baseline and current team depth.',sourceIds=js)
 if after:x.update(availabilityStatus='ACTIVE',assignmentEvidence='REPORTED_STARTER')
 return x
c['roleChain']=dict(before=[assignment('RG','Patrick Mekari'),assignment('LG','Ezra Cleveland')],after=[assignment('RG','Ezra Cleveland',True),assignment('LG','Emmanuel Pregnon',True)])
c=case(jax,'DaVon Hamilton',js,status='PARTIAL_GAME',reps=['Albert Regis'],role='Team depth identifies reserve nose tackle Regis; equal frozen values make any partial unavailable fraction immaterial under normal-active-effectiveness assumption.')
c.update(resolution='PARTIAL_VALUE_INVARIANT',activeEffectivenessConvention='NO_UNREPORTED_IMPAIRMENT')
impute(jax,'Keith Taylor','CB',['Christian Braswell'],js,'https://www.maddenratings.com/keith-taylor')
b['valueEstimates'][-1].update(method='INDEPENDENT_MADDEN_27',maddenOvr=65,ratingVersion='MADDEN_NFL_27',provider='MaddenRatings.com',rationale='Independent page identifies Keith Taylor Jr., cornerback, Madden NFL 27 overall 65; name alias matches retained Jaguars cornerback.')
b['sources'][-1]['finding']='Independent Madden NFL 27 page identifies Keith Taylor Jr. as cornerback with overall 65. This is not official EA capture.'
impute(jax,'Jared Bartlett','LB',['Jahlani Tavai'],js,'https://www.maddenratings.com/jared-bartlett')
for n in ['C.J. Williams','Tanner Koziol','Daniel Faalele','Wesley Williams','Jack Kiser','Jalen Huskey']:exclude(jax,n,'HEALTHY_SCRATCH',js,'Final inactive list; no injury-related loss identified.')
exclude(jax,'Quinn Ewers','BACKUP_QB_NO_LOST_DUTY',js,'Inactive backup; Lawrence remained the game quarterback.')
for n in ['Nick Gargiulo','Frank Crum','Caleb Lohner','Michael Deiter','Matt Henningsen']:case(den,n,ns)
exclude(den,'Drew Sanders','RELEASED_BEFORE_GAME',ns,'September 8 waiver follows prior waived/injured transaction; no longer a retained game-day absence.')
impute(den,'Levelle Bailey','MLB',['Karene Reid'],ns,'https://www.maddenratings.com/levelle-bailey')
case(den,'RJ Harvey',ns,status='OUT',reps=['J.K. Dobbins','Jonah Coleman','Tyler Badie'],role='All three participated at running back. Equal incremental-role allocation assumed; overall snap counts do not establish incremental shares.')
case(den,'Marvin Mims Jr',ns,status='OUT',reps=['Troy Franklin','Pat Bryant II','Courtland Sutton','Jaylen Waddle',"Lil'Jordan Humphrey"],role='Available receiver committee absorbs receiving duties; punt-return replacement Abrams-Draine tracked separately without adding a second receiver value.')
for n in ['Kage Casey','Dallen Bentley','Jordan Jackson','Tyler Onyedim']:exclude(den,n,'HEALTHY_SCRATCH',ns,'Final inactive list with no injury designation for these names.')
exclude(den,'Sam Ehlinger','BACKUP_QB_NO_LOST_DUTY',ns,'Inactive backup; Nix played all offensive snaps.')
den['participationReviews']=[dict(player='Quinn Meinerz',finding='Two missed snaps are observed but injury cause is not established. Do not manufacture an injury deduction from substitution alone.',sourceIds=['den-snaps'])]
b['games'].append(dict(gameKey=k,away='JAX',home='DEN',state='READY',teams=[jax,den]))
def supplemental(name):
 cap=json.load(open(root/'data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json'))
 rows=[p for p in cap['playersAbsentFromLockedRegistry'] if p['fullName']==name]
 if len(rows)!=1:raise ValueError(('supplement',name,len(rows)))
 p=rows[0];binding=b.setdefault('valueSupplements',[dict(path='data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json',commit='bf60eaf5dfd443edff5e13e5896cc30b6193dc44',blobSha='7bd98ecfd85aee88630be9f1204cc0b09379d494',estimateAcknowledged=True,rationale='Official EA Week 1 retrospective missing-identity capture; frozen identities never overwritten.',eaPlayerIds=[])])[0]
 if str(p['eaPlayerId']) not in binding['eaPlayerIds']:binding['eaPlayerIds'].append(str(p['eaPlayerId']))
 return dict(player=name,eaPlayerId=str(p['eaPlayerId']))
def independent(t,name,pos,reps,sources,url,ovr):
 c=impute(t,name,pos,reps,sources,url)
 b['valueEstimates'][-1].update(method='INDEPENDENT_MADDEN_27',maddenOvr=ovr,ratingVersion='MADDEN_NFL_27',provider='MaddenRatings.com',rationale='Independent player rating converted through unchanged frozen curve, explicitly not official EA capture.')
 b['sources'][-1]['finding']=f'Independent Madden NFL 27 player page reports overall {ovr}; matched identity and position.'
 return c
k='2026-W02-NO-BAL'
os=[source('no-tx','https://www.neworleanssaints.com/team/transactions/2026','Retained reserves and settlements reconciled; no injury-settlement players retained as losses.',k),source('no-roster','https://www.neworleanssaints.com/team/players-roster/','Retained reserves include Audric Estime and earlier missing-player names.',k),source('no-depth','https://www.neworleanssaints.com/team/depth-chart','Source-listed active replacement roles in backfield, receiving, line and defensive front.',k),source('no-bal-final','https://www.neworleanssaints.com/news/new-orleans-saints-inactives-baltimore-ravens-2026-nfl-week-2-gameday','Final inactive lists for both teams; Christen Miller and Stalbird out, Flowers/Madubuike/Buchanan out; other scratches separated.',k),source('no-banks','https://www.neworleanssaints.com/news/left-tackle-asim-richards-was-ready-for-the-moment-in-sundays-win-over-ravens','Kelvin Banks left with 2:02 in Q3 and Richards replaced him; no return. Shough completed game; final 24–17 in regulation.',k),source('no-daly','https://www.neworleanssaints.com/news/new-orleans-saints-roster-moves-announced-transactions-2026-nfl-week-2-elevations','Daly and Kevin Austin elevated for the game.',k),source('no-wood','https://www.neworleanssaints.com/news/cj-donaldson-scott-daly-saints-roster-moves-transaction-alert-september-18-2026','Wood placed on IR; professional long snapper Daly signed; CJ Donaldson promoted to active roster.',k)]
rs=[source('bal-tx','https://www.baltimoreravens.com/team/transactions/2026','Tampa and Lane retained IR, Kone/Randall/Pinter reserves; Carl Jones promoted.',k),source('bal-depth','https://www.baltimoreravens.com/team/depth-chart','Vinson tackle reserve, Simpson inside linebacker role, defensive-front and receiver assignments.',k),source('bal-post','https://www.baltimoreravens.com/news/rashod-bateman-ravens-grades-snap-counts-mark-andrews-mike-green-trenton-simpson-devontez-walker-chris-moore','Bateman took lead receiver role; Moore/Wester/Walker supplied other receiving duties, Sarratt did not play. Simpson filled linebacker duties.',k),source('bal-injury-post','https://www.baltimoreravens.com/news/ravens-rio-brazil-field-conditions-no-concerns-travel-nnamdi-madubuike-zay-flowers-injury-update-trenton-simpson-penalties','Stanley did not play Q4 with toe injury; Hendrickson played with wrapped hand. No unmeasured active-play impairment fraction assigned.',k),'no-bal-final','no-banks']
no=team('NO',os);bal=team('BAL',rs)
for n in ['Lorenzo Styles Jr','Jaylan Ford','Mason Tipton','Moliki Matavao','Rejzohn Wright','Isaiah Stalbird']:case(no,n,os)
case(no,'David Long Jr',os,identity=supplemental('David Long Jr'))
case(no,'Jordyn Tyson',os,reps=['Devaughn Vele'],role='Available outside receiver Vele receives primary additional role in Tyson vacancy; no other simultaneous case uses Vele.')
# Donaldson's identity is documented but its value is missing; add only the replacement prior.
c=impute(no,'CJ Donaldson','RB',['Alvin Kamara'],os,'https://www.maddenratings.com/cj-donaldson');no['cases'].remove(c)
case(no,'Ty Chandler',os,reps=['CJ Donaldson'],role='Promoted reserve back Donaldson covers reserve backfield duty; his value is explicitly imputed.')
case(no,'Audric Estime',os,reps=['Travis Etienne Jr','Alvin Kamara'],role='Remaining experienced backfield takes this separate reserve-role loss; explicit equal incremental-duty estimate, no overlap with Donaldson allocation.')
case(no,'Dillon Radunz',os,reps=['Will Sherman'],role='Depth reserve interior lineman covers this vacancy; no other case reserves Sherman.')
case(no,'Bryan Bresee',os,reps=['Vernon Broughton'],role='Source-listed interior starter supplies Bresee vacant defensive-line role; additional duties only.')
case(no,'Christen Miller',os,status='OUT',reps=['Colby Wooden'],role='Available interior reserve Wooden supplies the separate Miller vacancy; Broughton not reused.')
independent(no,'Nick Saldiveri','RG',['Jeremiah Wright'],os,'https://www.maddenratings.com/nick-saldiveri',63)
exclude(no,'Brock Rechsteiner','CAMP_ROSTER_ONLY',os,'Suspended undrafted rookie with no established regular-season duty; projected healthy roster role excluded explicitly, not a missing value set to zero.')
c=case(no,'Kelvin Banks Jr',os,status='PARTIAL_GAME',reps=['Asim Richards'],role='Official report identifies Richards as direct injury replacement.');exposure(c,['no-banks'],2578,2578)
no['specialistCases']=[dict(player='Zach Wood',position='LS',replacementPlayer='Scott Daly',method='NEUTRAL_SPECIALIST_REPLACEMENT_ESTIMATE',estimateAcknowledged=True,availableProfessionalReplacement=True,materialRoleDisruption=False,rationale='Veteran long snapper signed and elevated to fill Wood role. Neutral difference assumed; no snapping disruption identified in reviewed game reports.',sourceIds=['no-wood','no-banks'],replacementSourceIds=['no-daly','no-wood'])]
for n in ['Kendre Miller','Decamerion Richardson','Mason Murphy','John Ridgeway III']:exclude(no,n,'HEALTHY_SCRATCH',os,'Final inactive list cross-checked with final injury designations; no identified injury loss for this scratch.')
exclude(no,'Zach Wilson','BACKUP_QB_NO_LOST_DUTY',os,'Emergency third QB; Shough completed game duties.')
cluster(no,'OFFENSIVE_LINE',os,'Separate reserve interior vacancy and partial starting-tackle absence have distinct replacements; no extra interaction multiplier assumed.')
for n in ['T.J. Tampa','Bilhal Kone','Adam Randall','Danny Pinter']:case(bal,n,rs)
case(bal,'Teddye Buchanan',rs,status='OUT',reps=['Trenton Simpson'],role='Official reporting identifies Simpson occupying the unavailable linebacker role.')
case(bal,'Nnamdi Madubuike',rs,status='OUT',reps=['Travis Jones','Calais Campbell','John Jenkins'],role='Retained reviewed defensive-line committee with explicit equal additional-duty allocation.')
case(bal,'Zay Flowers',rs,status='OUT',reps=['Rashod Bateman'],role='Official postgame reporting identifies Bateman as primary lead-receiver replacement; existing duties preserved.')
case(bal,"Ja'Kobi Lane",rs,reps=['Chris Moore','Lajohntay Wester','Devontez Walker'],role='Distinct additional receiving duties for second unavailable receiver; Bateman not reused. Sarratt excluded because official report records no snaps.')
c=case(bal,'Ronnie Stanley',rs,status='PARTIAL_GAME',reps=['Carson Vinson'],role='Named tackle reserve supplies Stanley LT vacancy; source states Stanley did not play Q4.');exposure(c,['bal-injury-post','no-banks'],2700,2700)
for n in ['Andrew Vorhees','Gerad Lichtenhan']:exclude(bal,n,'HEALTHY_SCRATCH',rs,'Final inactive without an established injury-related game-day loss.')
for n in ['Joe Fagnano','Skylar Thompson']:exclude(bal,n,'BACKUP_QB_NO_LOST_DUTY',rs,'Backup quarterback unavailable; Lamar Jackson completed game duties.')
bal['participationReviews']=[dict(player='Trey Hendrickson',finding='Played with wrapped hand. Normal active effectiveness is an explicit assumption; no unsupported medical impairment percentage assigned.',sourceIds=['bal-injury-post'])]
bal['receiverClusterReview']=dict(eligible=False,estimateAcknowledged=True,rationale='Flowers is unavailable, but Andrews and Bateman both have higher frozen values than Lane and remain available. Two highest-valued receiving options are not simultaneously unavailable.',sourceIds=rs)
b['games'].append(dict(gameKey=k,away='NO',home='BAL',state='READY',teams=[no,bal]))
# Additional retained reserve discovered in Baltimore's current roster.
rs.append(source('bal-roster','https://www.baltimoreravens.com/team/players-roster/','Retained reserve list also includes rookie Jahquez Robinson.',k))
exclude(bal,'Jahquez Robinson','CAMP_ROSTER_ONLY',rs,'Rookie waived/injured in camp with no established regular-season role; projected-role exclusion explicitly assumed.')
k='2026-W02-PIT-NE'
ps=[source('pit-tx','https://www.steelers.com/team/transactions/2026','Retained Driscoll, Elliott, Kent and Lee absences reconciled with roster.',k),source('pit-roster','https://www.steelers.com/team/players-roster/','Retained injured and PUP inventory.',k),source('pit-depth','https://www.steelers.com/team/depth-chart/','Receiver, safety and cornerback depth identities reconciled with gamebook active list.',k),source('pit-final','https://www.steelers.com/news/steelers-inactives-for-week-2-vs-patriots-x2429','Pittman and Porter ruled out; Dean and Samuel called upon at cornerback.',k),source('pit-ne-book','https://static.clubs.nfl.com/image/upload/patriots/iciistmq5pxqidx7g4nu.pdf','Official gamebook supplies lineups, active/inactive identities, injury and return clock bounds, and final 20–3 regulation result. Substitution alone is not an injury.',k)]
ns=[source('ne-tx','https://www.patriots.com/team/transactions/2026','Retained reserves reconciled with roster; postgame Onwenu IR not treated as full-game pre-existing absence.',k),source('ne-roster','https://www.patriots.com/team/players-roster/','Retained injured/PUP/NFI inventory includes Brown and Myles Montgomery.',k),source('ne-depth','https://www.patriots.com/team/depth-chart','Named reserve roles checked against gamebook active participants.',k),source('ne-brown','https://www.patriots.com/news/analysis-patriots-place-wr-a-j-brown-on-injured-reserve-sign-dt-daquan-jones','Brown on IR September 12; Hollins takes X role, Chism fills Hollins prior base-role duties.',k),source('ne-film','https://www.patriots.com/news/after-further-review-drake-maye-film-breakdown-defense-review-and-quick-hit-film-notes-from-the-week-2-win-over-the-steelers','Van Roten replaced Onwenu, Charles Woods replaced Davis, Reed replaced Woodson while also having prior third-safety duty; Raridon left injured.',k),source('ne-post','https://www.patriots.com/news/game-observations-8-takeaways-from-the-patriots-win-over-the-steelers-in-week-2','In-game injuries to Onwenu, Raridon, DreMont Jones, Pettus and Woodson; Maye completed game.',k),'pit-ne-book']
pit=team('PIT',ps);ne=team('NE',ns)
for n in ['Jack Driscoll','Donte Kent','Logan Lee']:case(pit,n,ps)
case(pit,'DeShon Elliott',ps,reps=['Rayshawn Jenkins'],role='Available veteran safety Jenkins allocated Elliott vacancy; retained Brisker remains separate.')
case(pit,'Michael Pittman',ps,status='OUT',reps=['DK Metcalf','Germie Bernard','Roman Wilson','Pat Freiermuth'],role='Previously reviewed available receiving committee; all participants verified in final gamebook. Equal added-duty shares assumed.')
case(pit,'Joey Porter',ps,status='OUT',reps=['Asante Samuel Jr'],role='Official inactive report and gamebook establish Samuel alongside retained Dean; Samuel supplies Porter vacancy.')
c=case(pit,'Jaquan Brisker',ps,status='PARTIAL_GAME',reps=['Robert Spears-Jennings'],role='Available reserve safety assigned brief vacancy by documented depth estimate; Jenkins already covers Elliott and is not reused.');exposure(c,['pit-ne-book'],717,717,789,789)
c=case(pit,'Rico Dowdle',ps,status='PARTIAL_GAME',reps=['Jaylen Warren'],role='Healthy backfield partner has equal locked value; time fraction cannot change zero replacement loss under normal-active-effectiveness estimate.');c.update(resolution='PARTIAL_VALUE_INVARIANT',activeEffectivenessConvention='NO_UNREPORTED_IMPAIRMENT')
for n in ['Gennings Dunker','Kevin Jobity Jr','Gabriel Rubio']:exclude(pit,n,'HEALTHY_SCRATCH',ps,'Gamebook inactive; no injury-related role loss established.')
for n in ['Drew Allar','Will Howard']:exclude(pit,n,'BACKUP_QB_NO_LOST_DUTY',ps,'Unavailable backup; Rodgers remained game quarterback until late substitution, with no injury cause established.')
pit['qbAvailability']['rationale']='Rodgers handled the game before late Rudolph substitution; no injury cause reported. Do not convert performance or late-game substitutions into QB injury loss.'
cluster(pit,'DEFENSIVE_BACK',ps,'Separate Elliott/Porter vacancies and brief Brisker absence use distinct relief identities. Additive interaction estimate.')
for n in ['Marcus Bryant','Brenden Schooler','Julian Hill','Dametrious Crownover']:case(ne,n,ns)
case(ne,'Khalil Jacobs',ns,identity=supplemental('Khalil Jacobs'))
case(ne,'Harold Landry III',ns,reps=['Elijah Ponder','Quintayvious Hutchins'],role='Available edge roles cover long-term Landry vacancy; Jacas reserved separately for in-game DreMont Jones duty.')
case(ne,'Carlton Davis III',ns,status='OUT',reps=['Charles Woods'],role='Official film review explicitly identifies Woods filling Davis role.')
c=case(ne,'A.J. Brown',ns,reps=['Efton Chism III'],role='Documented receiver chain: Hollins moves into Brown X role; Chism fills Hollins prior base receiving/blocking role. Retained Hollins value cancels.')
c.update(resolution='RECONCILED_ROLE_CHAIN',modelId='graham-reconciled-role-chain-v1',baselineTreatment='RECONCILED_ROLE_CHAIN',baselineDutiesDisplaced=True)
def receiver_assignment(role,name,after=False):
 x=dict(role=role,**who(name),rationale='Documented Brown/Hollins/Chism receiver assignment chain.',sourceIds=['ne-brown','pit-ne-book'])
 if after:x.update(availabilityStatus='ACTIVE',assignmentEvidence='REPORTED_ROLE')
 return x
c['roleChain']=dict(before=[receiver_assignment('X','A.J. Brown'),receiver_assignment('BASE_RECEIVER','Mack Hollins')],after=[receiver_assignment('X','Mack Hollins',True),receiver_assignment('BASE_RECEIVER','Efton Chism III',True)])
impute(ne,'Andrew Rupcich','LG',['Ben Brown'],ns,'https://www.maddenratings.com/andrew-rupcich')
# Kiner is in official supplement; make identity available to the builder without overriding production data.
p=supplemental('Corey Kiner');cap=json.load(open(root/'data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json'));row=next(x for x in cap['playersAbsentFromLockedRegistry'] if x['fullName']=='Corey Kiner');registry.append(dict(player='Corey Kiner',eaPlayerId=row['eaPlayerId']))
impute(ne,'Terrell Jennings','RB',['Corey Kiner'],ns,'https://www.maddenratings.com/terrell-jennings')
impute(ne,'Jeremiah Webb','WR',['Kyle Williams'],ns,'https://www.maddenratings.com/jeremiah-webb')
exclude(ne,'Myles Montgomery','CAMP_ROSTER_ONLY',ns,'Rookie camp reserve without established regular-season duty; explicit projected-role assumption.')
for n in ['Eli Raridon','Dell Pettus']:case(ne,n,ns,status='PARTIAL_GAME')
c=case(ne,'Mike Onwenu',ns,status='PARTIAL_GAME',reps=['Greg Van Roten'],role='Actual injury relief confirmed by film review; Q1 injury play at 1:08, injury timeout 0:58, no return.');exposure(c,['pit-ne-book'],832,842)
c=case(ne,'Craig Woodson',ns,status='PARTIAL_GAME',reps=['Jaylen Reed'],role='Official film identifies Reed supplying added safety duties after Woodson left; his prior third-safety duties remain baseline. Last named active play at Q3 9:54, questionable update at 2:27; no return.');exposure(c,['pit-ne-book'],2106,2553)
c=case(ne,"Dre'Mont Jones",ns,status='PARTIAL_GAME',reps=['Gabe Jacas'],role='Available depth edge Jacas assigned additional duty, distinct from Landry coverage; equal frozen values make time fraction immaterial.');c.update(resolution='PARTIAL_VALUE_INVARIANT',activeEffectivenessConvention='NO_UNREPORTED_IMPAIRMENT')
c=case(ne,'Marcus Jones',ns,status='PARTIAL_GAME',reps=['Karon Prunty'],role='Available reserve corner Prunty selected by depth estimate for brief absence; Woods/Reed already allocated distinct vacancies.');exposure(c,['pit-ne-book'],1782,1788,1792,1792)
ne['specialistCases']=[dict(player='Bryce Baringer',position='P',replacementPlayer='Mitch Wishnowsky',method='NEUTRAL_SPECIALIST_REPLACEMENT_ESTIMATE',estimateAcknowledged=True,availableProfessionalReplacement=True,materialRoleDisruption=False,rationale='Gamebook confirms veteran Wishnowsky handled all punts and holds. Neutral difference assumed, with unquantified specialist uncertainty.',sourceIds=ns,replacementSourceIds=['pit-ne-book'])]
for n in ['Walter Rouse','Tanner Arkin','Leonard Taylor III']:exclude(ne,n,'HEALTHY_SCRATCH',ns,'Gamebook final inactive without established injury-related loss.')
exclude(ne,'Behren Morton','BACKUP_QB_NO_LOST_DUTY',ns,'Emergency third quarterback; Maye completed game duties.')
cluster(ne,'DEFENSIVE_BACK',ns,'Davis, Woodson and brief Jones vacancy assigned distinct additional-duty recipients; no extra interaction multiplier assumed.')
b['games'].append(dict(gameKey=k,away='PIT',home='NE',state='READY',teams=[pit,ne]))
# Reusable helpers for remaining pairs.
def qb_loss(t,healthy,relief,sources,startlo=0,starthi=0,duration=3600,why='Injury-driven absence with documented replacement.'):
 q=dict(state='HISTORICAL_REPLACEMENT_ESTIMATE',estimateAcknowledged=True,lossCause='INJURY_UNAVAILABILITY',rationale=why,sourceIds=sources,healthyCandidates=[who(n) for n in healthy],replacement=who(relief),baselineRationale='One healthy starting-quarterback role; equal-valued candidates if competition unresolved.',baselineSourceIds=sources,replacementRationale=why,replacementSourceIds=sources)
 x={'resolution':'PRIMARY_REPLACEMENT'};exposure(x,sources,startlo,starthi,duration,duration,duration);q['exposure']=x['exposure'];t['qbAvailability']=q

def primary(t,n,r,ss,status='IR',why=None):return case(t,n,ss,status=status,reps=[r],role=why or 'Available source-listed depth replacement assigned this distinct vacancy; additional-duty assignment is an explicit estimate.')
def zeroes(t,names,ss):
 for n in names:case(t,n,ss)
def healthy(t,names,ss):
 for n in names:exclude(t,n,'HEALTHY_SCRATCH',ss,'Final inactive without injury-related absence; no game-day strength loss assigned.')
def camp(t,names,ss):
 for n in names:exclude(t,n,'CAMP_ROSTER_ONLY',ss,'Camp reserve/waived-injured fringe roster entry, no established regular-season role in reviewed team depth. Explicit healthy-baseline projection; retained contract status is not assumed from waiver alone.')
def receiver_review(t,ss,why):t['receiverClusterReview']=dict(eligible=False,estimateAcknowledged=True,rationale=why,sourceIds=ss)
k='2026-W02-MIN-CHI'
ms=[source('min-tx','https://www.vikings.com/team/transactions/2026','Mason IR and Dallas activated; Adams and Yurosek reserve status.',k),source('min-roster','https://www.vikings.com/team/players-roster/','Jurgens, Batty, Chappell, Yurosek, Adams and suspended Jeshaun Jones retained reserve inventory.',k),source('min-depth','https://www.vikings.com/team/depth-chart','Game-available RB, receiver, linebacker relief roles; reconciled against inactive list.',k),source('min-final','https://www.vikings.com/news/inactives-bears-week-2-2026','Murray and Jennings out; ONeill active; other inactive names healthy.',k),source('min-post','https://www.vikings.com/news/aaron-jones-warrior-mentality-week-2-win-at-bears','Ingram-Dawkins hip, Banks relief; Cashman briefly left opening Q3 drive and Pace filled in; Wentz completed duties.',k)]
cs=[source('chi-tx','https://www.chicagobears.com/team/transactions/2026','September/August reserve moves and waived-injured designations; no waiver treated as proof of retained contract.',k),source('chi-roster','https://www.chicagobears.com/team/players-roster/','Retained reserve list includes Kalinic; Gordon and Turner PUP.',k),source('chi-depth','https://www.chicagobears.com/team/depth-chart','Woods, Lewis, Street and available reserve roles.',k),source('chi-final','https://www.vikings.com/news/inactives-bears-week-2-2026','Both teams final inactive coverage.',k),source('chi-post','https://www.chicagobears.com/news/game-recap-bears-fall-to-1-1-with-loss-to-vikings','Williams left midway Q4 before blocked field goal at 6:21; Bagent finished including final play. Final 9–3 in regulation.',k)]
mi=team('MIN',ms);ch=team('CHI',cs)
zeroes(mi,['Michael Jurgens','Tyler Batty','Benjamin Yurosek','Taki Taimani','Tyrion Ingram-Dawkins'],ms)
primary(mi,'Jamal Adams','Jake Golday',ms)
case(mi,'Jordan Mason',ms,reps=['Aaron Jones Sr','Demond Claiborne','DeeJay Dallas'],role='Available backfield receives Mason additional duties with explicit equal allocation, preserving existing workload.')
case(mi,'Jauan Jennings',ms,status='OUT',reps=['Tai Felton','Myles Price'],role='Available reserve receivers allocated Jennings third-receiver duties; Jefferson/Addison retain baseline roles.')
c=primary(mi,'Blake Cashman','Ivan Pace Jr',ms,'PARTIAL_GAME');exposure(c,ms,1800,2700,2700,2700);c['exposure']['assumptionRationale']='Brief absence on opening Q3 drive; exact return clock not recovered. Explicit broad zero-to-one-quarter unavailable-duration bound, midpoint 450 seconds; normal effectiveness on return assumed.'
qb_loss(mi,['Kyler Murray'],'Carson Wentz',ms)
camp(mi,['Tyreek Chappell'],ms)
impute(mi,'Jeshaun Jones','WR',['Dillon Bell'],ms,'https://www.maddenratings.com/jeshaun-jones')
healthy(mi,['Zemaiah Vaughn','Jakobe Thomas','Nick Samac','Caleb Tiernan','Elijah Williams'],ms)
zeroes(ch,['Brittain Brown','Tony Fields II','Noah Sewell','Nephi Sewell','Ruben Hyppolite II'],cs)
case(ch,'Jaylon Jones',cs,identity=dict(player='Jaylon Jones',eaPlayerId='22530'))
for n in ['Hayden Large','Dallis Flowers','Jonathan Garvin']:case(ch,n,cs,identity=supplemental(n))
primary(ch,'Coby Bryant','Xavier Woods',cs)
primary(ch,'Kyler Gordon','Cam Lewis',cs)
primary(ch,'Shemar Turner','Kentavius Street',cs)
primary(ch,'Ray-Ray McCloud III','Kalif Raymond',cs)
primary(ch,'Beanie Bishop Jr','Clark Phillips III',cs,why='Waived-injured retention unresolved in current roster; conservatively retain reserve-role scenario. Available corner equal value makes loss zero under either retained-role or no-role scenario.')
camp(ch,['Dontae Manning'],cs)
impute(ch,'Nikola Kalinic','TE',['Sam Roush'],cs,'https://www.maddenratings.com/nikola-kalinic')
qb_loss(ch,['Caleb Williams'],'Tyson Bagent',cs,2700,3219,why='Williams left in Q4 before field goal at 6:21 remaining; broad quarter-start-to-pre-field-goal departure bound. Bagent finished. Midpoint is an estimate, not an exact injury clock.')
healthy(ch,['Ozzy Trapilo','Jamree Kromah','Jordan McFadden','Jayden Loving'],cs)
exclude(ch,'Case Keenum','BACKUP_QB_NO_LOST_DUTY',cs,'Unused emergency quarterback; Bagent supplied required relief.')
receiver_review(mi,ms,'Jennings absent but Jefferson and Hockenson remain available; no simultaneous loss of top two expected receiver values.')
b['games'].append(dict(gameKey=k,away='MIN',home='CHI',state='READY',teams=[mi,ch]))
k='2026-W02-CAR-ATL'
ss=[source('car-roster','https://www.panthers.com/team/players-roster/','Retained IR/NFI/PUP list reconciled against Week 2 final inactives.',k),source('car-depth','https://www.panthers.com/team/depth-chart','Walker LT, Freeling RT, available depth and distinct reserve roles.',k),source('car-final','https://www.panthers.com/news/week-2-inactives-at-atlanta-pat-jones-out-for-falcons-game-bobby-brown-panthers-falcons','Patrick Jones and Bobby Brown injured inactive; remaining scratches healthy.',k),source('car-post','https://www.panthers.com/news/rapid-reactions-bryce-young-panthers-continue-winning-ways-in-atlanta-devin-lloyd-darren-waller','Scott ribs first play, Cherelus carted, Gipson concussion evaluation Q4, Brooks groin; Young replaced for end-game rest. Final 34–3 in regulation.',k)]
ats=[source('atl-roster','https://www.atlantafalcons.com/team/players-roster/','Retained reserve and suspended Pearce; Terrell IR after game assessed as partial loss only.',k),source('atl-depth','https://www.atlantafalcons.com/news/atlanta-falcons-depth-chart-carolina-panthers','Dated Week 2 roles; Tua listed QB1 with Rush backup, named defensive depth.',k),source('atl-final','https://www.atlantafalcons.com/news/atlanta-falcons-week-2-inactives-vs-carolina-panthers','Tua/Penix/Bowman out, Lindstrom and Deablo active; DeWalt/Onianwa healthy scratches.',k),source('atl-post','https://www.atlantafalcons.com/news/jack-strand-debut-harold-perkins-jr-versatility-notes-panthers-vs-falcons','Rush replaced by Strand after turnovers, not injury.',k),source('atl-terrell','https://www.atlantafalcons.com/news/falcons-place-aj-terrell-jr-on-injured-reserve','Terrell left Q1, groin, no return; Henderson covered outside CB.',k),'car-post']
ca=team('CAR',ss);at=team('ATL',ats)
zeroes(ca,['Trevor Etienne','Bam Martin-Scott','Claudin Cherelus','Trevis Gipson'],ss)
for n,r in [('Taylor Moton','Monroe Freeling'),('Ikem Ekwonu','Rasheed Walker'),('Brady Christensen','Corey Bullock'),('Chris Brazzell II','John Metchie III'),('Nic Scourton','Princely Umanmielen'),('Tershawn Wharton','Lee Hunter'),('Bobby Brown III','TeRah Edwards'),('Patrick Jones II','Thomas Incoom')]:primary(ca,n,r,ss,'OUT' if n in ['Bobby Brown III','Patrick Jones II'] else 'IR')
c=primary(ca,'Nick Scott','Lathan Ransom',ss,'PARTIAL_GAME');exposure(c,ss,0,60);c['exposure']['assumptionRationale']='First-play departure; conservative opening-minute bound, no return.'
c=primary(ca,'Jonathon Brooks','A.J. Dillon',ss,'PARTIAL_GAME');exposure(c,ss,0,3600);c['exposure']['assumptionRationale']='Groin absence reported without recovered injury clock or return; full zero-to-game-length duration bound and midpoint estimate, not a precise participation finding.'
healthy(ca,["Ja'Tavion Sanders",'Chau Smith-Wade','Tyrel Dodson','Albert Reese'],ss)
exclude(ca,'Haynes King','BACKUP_QB_NO_LOST_DUTY',ss,'Inactive emergency quarterback; Pickett end-game relief was not injury driven.')
cluster(ca,'OFFENSIVE_LINE',ss,'Distinct LT, RT and reserve interior assignments, no repeated substitute or added interaction multiplier.')
zeroes(at,['JD Bertrand','Trey Sermon','Cameron Williams','Beaux Collins'],ats)
case(at,'Storm Norton',ats,identity=supplemental('Storm Norton'))
independent(at,'DeAngelo Malone','MLB',['Kendal Daniels'],ats,'https://www.maddenratings.com/deangelo-malone',62)
camp(at,['Anterio Thompson'],ats)
primary(at,"Da'Shawn Hand",'Gervon Dexter Sr',ats)
primary(at,'Jalon Walker',"Za'Darius Smith",ats)
primary(at,'James Pearce Jr','Samson Ebukam',ats,'SUSPENDED')
primary(at,'Billy Bowman Jr','Avieon Terrell',ats,'OUT')
c=primary(at,'A.J. Terrell Jr','C.J. Henderson',ats,'PARTIAL_GAME');exposure(c,ats,0,900)
qb_loss(at,['Tua Tagovailoa'],'Cooper Rush',ats,why='Dated depth establishes healthy Tua starting role. Rush was the available primary injury replacement throughout; later performance benching for Strand is not a second injury loss. Value the available primary relief option, not the chosen end-game substitute.')
at['participationReviews']=[dict(player='Cooper Rush / Jack Strand',finding='Performance substitution. The historical counterfactual values the available designated injury replacement Rush; no invented rating is assigned Strand and no extra injury deduction is made.',sourceIds=ats),dict(player='Jawaan Taylor / Brandon Dorlus',finding='Substitution and subsequent minor injury listing do not alone establish an additional unavailable interval; normal active effectiveness assumed with unquantified impairment uncertainty.',sourceIds=ats)]
healthy(at,['Malcolm DeWalt IV','Ethan Onianwa'],ats)
b['games'].append(dict(gameKey=k,away='CAR',home='ATL',state='READY',teams=[ca,at]))
k='2026-W02-GB-NYJ'
gs=[source('gb-roster','https://www.packers.com/team/players-roster/','Oliver, Savion Williams, Musgrave, Parsons and Riley reserves; Jacobs exempt list.',k),source('gb-depth','https://www.packers.com/team/depth-chart','Available line, edge, receiver and secondary relief roles.',k),source('gb-final','https://www.packers.com/news/packers-jets-week-2-inactives-sept-20-2026','Hargrave, Brinson, St-Juste out; Banks and Bako-Bewele active.',k),source('gb-post','https://www.packers.com/news/game-recap-5-takeaways-from-packers-overtime-victory-over-jets-week-2-2026','Reed and Bako-Bewele first-series exits; Belton RT, Banks later injured then Jennings injured with Burton filling LG. Melton/Campbell assessed; Love no missed snaps.',k),source('gb-alias','https://www.packers.com/team/players-roster/zach-bako-bewele/','Official biography and consistent number/college identify Bako-Bewele as frozen Zach Tom identity, not a missing player.',k)]
ns=[source('nyj-tx','https://www.newyorkjets.com/team/transactions/2026','Retained reserves and released depth names; no Dean Clark replacement credit.',k),source('nyj-roster','https://www.newyorkjets.com/team/players-roster/','Additional retained reserves Tim Patrick and Kingsley Jonathan; Sep22 additions reconciled as in-game injuries.',k),source('nyj-depth','https://www.newyorkjets.com/team/depth-chart','Available receiver, safety, front and tight-end roles.',k),source('nyj-final','https://www.newyorkjets.com/news/jets-vs-packers-game-inactives-09-20-2026','Fitzpatrick, Ossai, Nwangwu unavailable; Ponds, Wallace, Grupe scratches. Sanders kicker.',k),source('nyj-post','https://www.newyorkjets.com/news/jets-packers-game-recap-week-2-09-20-2026','Onyemata, McCrary-Ball, Mauigoa exited without return; Mason Taylor thumb late. OT winning kick 5:23 remaining in 10-minute overtime: duration 3877 seconds.',k),source('nyj-new-ir','https://www.newyorkjets.com/news/jets-sign-jack-heflin-malik-mcclain-active-roster-onyemata-mccrary-ball-arian-smith-to-injured-reserve-09-22-2026','Smith knee during Week2, Onyemata/McCrary-Ball prior-game injury confirmed; new signings not retrospectively used.',k)]
gb=team('GB',gs+['nyj-post']);nj=team('NYJ',ns)
zeroes(gb,['Collin Oliver','Savion Williams','Luke Musgrave','Jordon Riley','Warren Brinson','Donovan Jennings','Anthony Campbell'],gs)
primary(gb,'Micah Parsons','Barryn Sorrell',gs)
case(gb,'Josh Jacobs',gs,status='COMMISSIONER_EXEMPT',reps=['Kaleb Johnson','MarShawn Lloyd','Chris Brooks'],role='Available documented three-back committee; equal incremental duty estimate.')
primary(gb,'Javon Hargrave','Jonathan Ford',gs,'OUT')
primary(gb,'Benjamin St-Juste','Carrington Valentine',gs,'OUT')
for n,r,lo,hi in [('Zach Tom','Anthony Belton',0,900),('Jayden Reed','Skyy Moore',0,900),('Aaron Banks','Jager Burton',0,3600)]:
 c=primary(gb,n,r,gs,'PARTIAL_GAME');exposure(c,gs+['nyj-post'],lo,hi,3877,3877,3877)
 if n=='Aaron Banks':c['assumptionRationale']='Jennings then Burton both have zero frozen value; using final relief Burton gives same replacement value throughout Banks absence. Departure time broad regulation bound, not exact.'
c=primary(gb,'Bo Melton','J. Michael Sturdivant',gs,'PARTIAL_GAME');exposure(c,gs+['nyj-post'],0,3877,3877,3877,3877)
gb['participationReviews']=[dict(player='Jordan Love',finding='Elbow hit and temporary numbness reported, no missed snaps. Normal active effectiveness estimate; unquantified impairment uncertainty, no invented percentage.',sourceIds=gs)]
healthy(gb,['Travis Glover','John Williams'],gs)
receiver_review(gb,gs,'Reed and Melton affected; Kraft remains available and is the highest frozen receiving value. Top-two simultaneous loss condition not met.')
cluster(gb,'OFFENSIVE_LINE',gs,'Separate RT/LG vacancies with distinct incoming occupants; Jennings/Burton sequential zero-valued relief never double credited.')
zeroes(nj,['Tyler Baron','Tre Brown','Mykal Walker','Anez Cooper','VJ Payne','Kene Nwangwu','Marcelino McCrary-Ball','Kiko Mauigoa','Arian Smith'],ns)
camp(nj,['Chip Trayanum'],ns)
impute(nj,'Kingsley Jonathan','EDGE',['Braiden McGregor'],ns,'https://www.maddenratings.com/kingsley-jonathan')
primary(nj,'Omar Cooper Jr.','Isaiah Williams',ns)
primary(nj,'Tim Patrick','Adonai Mitchell',ns)
primary(nj,'Joseph Ossai','Will McDonald IV',ns,'OUT')
primary(nj,'Minkah Fitzpatrick','Andre Cisco',ns,'OUT')
c=primary(nj,'David Onyemata','Darrell Jackson Jr.',ns,'PARTIAL_GAME');exposure(c,ns,0,3877,3877,3877,3877)
c=primary(nj,'Mason Taylor','Kenyon Sadiq',ns,'PARTIAL_GAME');c.update(resolution='PARTIAL_VALUE_INVARIANT',activeEffectivenessConvention='NO_UNREPORTED_IMPAIRMENT')
healthy(nj,["D'Angelo Ponds",'Trevin Wallace','Blake Grupe'],ns)
receiver_review(nj,ns,'Garrett Wilson remains available; Patrick/Cooper and zero-valued Smith are not the two highest-valued expected receiving options.')
b['games'].append(dict(gameKey=k,away='GB',home='NYJ',state='READY',teams=[gb,nj]))
def impute_zero(t,name,pos,ss,url):
 c=impute(t,name,pos,[],ss,url);c.update(resolution='ZERO_IMPUTED_BASELINE_ESTIMATE',assumptionRationale='Explicit zero-valued position-group median gives a zero point loss for any nonnegative replacement. Cohort sensitivity is retained; no invented substitute or calibrated-zero proof.')
 return c
k='2026-W02-CIN-HOU'
cs=[source('cin-roster','https://www.bengals.com/team/players-roster/','Parker and JaSir Taylor retained IR.',k),source('cin-depth','https://www.bengals.com/team/depth-chart','Kris Jenkins reserve interior line role behind Hill; roster depth reconciled with final inactives.',k),source('cin-final','https://www.bengals.com/news/pregame-quick-hits-joe-burrow-gets-nod-shemar-makes-season-debut-with-b-j-hill-out','Hill unavailable; Burrow cleared, Stewart active. Remaining scratches not injury losses.',k),source('cin-post','https://www.bengals.com/news/postgame-quick-hits-bengals-win-texans-week-2-2026','Both starting QBs completed duties; Mims briefly left for shoe, not injury. Final 20–6 in regulation.',k)]
hs=[source('hou-roster','https://www.houstontexans.com/team/players-roster/','Retained reserve inventory includes Byrd; available roster role groups.',k),source('hou-tx','https://www.houstontexans.com/team/transactions/2026','Retained injury transactions, including older Takitaki, Turner and Washington; no subsequent release in reviewed record.',k),source('hou-depth','https://www.houstontexans.com/team/depth-chart','Official depth image and active roster reconciled for available additional-duty assignments.',k),source('hou-final','https://www.houstontexans.com/news/texans-inactives-week-2-vs-cincinnati-bengals','Collins, Ingram, Clowney out; final seven-player inactive list.',k),source('hou-post','https://www.houstontexans.com/news/texans-red-zone-short-yardage-third-down-focus','Postgame offensive review identifies continued Stroud duties and active Boutte/Schultz receiving work.',k),'cin-post']
ci=team('CIN',cs);ho=team('HOU',hs)
zeroes(ci,['Brian Parker II',"Ja'Sir Taylor"],cs);primary(ci,'B.J. Hill','Kris Jenkins Jr',cs,'OUT')
healthy(ci,['Landon Robinson',"Ke'Shawn Williams",'Josh Newton','Connor Lew','Myles Hinton'],cs)
exclude(ci,'Josh Johnson','BACKUP_QB_NO_LOST_DUTY',cs,'Unused third QB; Burrow started and completed game duties.')
ci['participationReviews']=[dict(player='Amarius Mims',finding='Brief absence caused by lost shoe; not injury unavailability.',sourceIds=cs)]
zeroes(ho,['Ali Gaye','Dylan Horton','Jacob Hummel'],hs)
impute(ho,'Solomon Byrd','EDGE',['Sabastian Harsh'],hs,'https://www.maddenratings.com/solomon-byrd')
case(ho,'Sam Hagen',hs,identity=supplemental('Sam Hagen'))
for n,r in [("Henry To'oTo'o",'Jake Hansen'),('E.J. Speed','Wade Woodaz'),('Kayden McDonald','Tommy Togiai'),('Braden Smith','Trent Brown'),('Nico Collins','Xavier Hutchinson'),('Jayden Higgins','Kayshon Boutte'),('Tank Dell','Jaylin Noel'),("Ja'Marcus Ingram",'Kamari Ramsey'),('Ed Ingram','Febechi Nwaiwu'),('Jadeveon Clowney','Dominique Robinson')]:primary(ho,n,r,hs,'OUT' if n in ['Nico Collins','Ed Ingram','Jadeveon Clowney'] else 'IR')
impute(ho,'M.J. Stewart','SS',['Reed Blankenship'],hs,'https://www.maddenratings.com/mj-stewart')
for n,pos,url in [('K.C. Ossai','LB','kc-ossai'),('Sione Takitaki','LB','sione-takitaki'),('DJ Turner','WR','dj-turner'),('Montrell Washington','WR','montrell-washington')]:impute_zero(ho,n,pos,hs,'https://www.maddenratings.com/'+url)
camp(ho,['Joshua Pitsenberger'],hs)
exclude(ho,'Graham Mertz','BACKUP_QB_NO_LOST_DUTY',hs,'Reserve quarterback not established starting baseline; Stroud remained available.')
healthy(ho,['Brevin Jordan','Collin Wright','Nate Thomas'],hs)
cluster(ho,'OFFENSIVE_LINE',hs,'Distinct RT and RG vacancies assigned Brown/Nwaiwu separately; no duplicate credit.')
cluster(ho,'LINEBACKER',hs,'Distinct reserve linebacker duties assigned separate active depth; additive interaction estimate.')
receiver_review(ho,hs,'Schultz remains available with .9 frozen value, above Higgins and Dell .5 each. Nico alone among the two highest-valued expected receiving options is unavailable.')
b['games'].append(dict(gameKey=k,away='CIN',home='HOU',state='READY',teams=[ci,ho]))
k='2026-W02-PHI-TEN'
ps=[source('phi-roster','https://www.philadelphiaeagles.com/team/players-roster/','Retained IR includes Andre Sam and Johnny Wilson; older veterans reconciled with transactions.',k),source('phi-tx','https://www.philadelphiaeagles.com/team/transactions/2026','Mitchell, Castro-Fields IR; Danny Gray practice-squad IR.',k),source('phi-depth','https://www.philadelphiaeagles.com/team/depth-chart','Jurgens LG, Kendall C; active receiving, backfield, edge and secondary depth.',k),source('phi-final','https://www.philadelphiaeagles.com/news/eagles-at-titans-inactives-week-2-2026-nfl-regular-season','Greenard out; Mukuba active; healthy scratches separated.',k),source('phi-live','https://www.philadelphiaeagles.com/news/eagles-at-titans-game-recap-september-20-2026-nfl-week-2-regular-season','Barkley left before Q1 12:17 and returned start Q3; Goedert questionable before Q2 8:53 and no return. Hurts/Ward finished 24–20 regulation.',k),source('phi-post','https://www.philadelphiaeagles.com/news/eagles-6-takeaways-from-an-incredible-come-from-behind-win-over-the-titans-jalen-hurts-devonta-smith-2026-nfl-week-2','Dickerson line displacement and Bigsby/Shipley/Mundt relief; Carter played with wrist cast.',k)]
ts=[source('ten-roster','https://www.tennesseetitans.com/team/players-roster/','Retained reserves include Brooks and Hampton, Mausi and Joshua Williams.',k),source('ten-tx','https://www.tennesseetitans.com/team/transactions/2026','Earlier reserves and releases reconciled.',k),source('ten-depth','https://www.tennesseetitans.com/team/depth-chart','Hill and Micah Robinson roles; depth assessed against final active identities.',k),source('ten-final','https://www.tennesseetitans.com/news/game-inactives-week-2-titans-vs-eagles','Flott and James Williams inactive despite earlier optimistic practice report; final game-day list controls.',k),source('ten-post','https://www.tennesseetitans.com/news/titans-see-lead-slip-away-in-closing-seconds-lose-24-20-to-eagles','Ward completed game; no other material injury absence reported in official game recap.',k),'phi-live']
ph=team('PHI',ps);te=team('TEN',ts)
zeroes(ph,['Grant Calcaterra'],ps)
impute_zero(ph,'Johnny Wilson','WR',ps,'https://www.maddenratings.com/johnny-wilson')
# Reuse the already-reviewed single-vacancy chain without replaying its prior evidence record.
chain=case(ph,'Landon Dickerson',ps,reps=['Drew Kendall'],role='Dickerson LG absence moves retained Jurgens from C to LG; Kendall enters at C. Retained value cancels.')
chain.update(resolution='RECONCILED_ROLE_CHAIN',modelId='graham-reconciled-role-chain-v1',baselineTreatment='RECONCILED_ROLE_CHAIN',baselineDutiesDisplaced=True)
def line_assignment(role,n,after=False):
 x=dict(role=role,**who(n),rationale='Documented single-vacancy line chain.',sourceIds=ps)
 if after:x.update(availabilityStatus='ACTIVE',assignmentEvidence='REPORTED_STARTER')
 return x
chain['roleChain']=dict(before=[line_assignment('LG','Landon Dickerson'),line_assignment('C','Cam Jurgens')],after=[line_assignment('LG','Cam Jurgens',True),line_assignment('C','Drew Kendall',True)])
primary(ph,'Eli Stowers','E.J. Jenkins',ps)
primary(ph,'Jakorian Bennett','Jonathan Jones',ps)
impute(ph,'Tariq Castro-Fields','CB',['Kelee Ringo'],ps,'https://www.maddenratings.com/tariq-castro-fields')
independent(ph,'Elijah Mitchell','RB',['Will Shipley'],ps,'https://www.maddenratings.com/elijah-mitchell',72)
camp(ph,['Tucker Large','Danny Gray','Andre Sam'],ps)
case(ph,'Jonathan Greenard',ps,status='OUT',reps=['Nolan Smith Jr','Arnold Ebiketie','A.J. Epenesa','Jalyx Hunt'],role='Documented available edge committee; equal incremental duties assumed.')
c=primary(ph,'Saquon Barkley','Tank Bigsby',ps,'PARTIAL_GAME');exposure(c,ps,72,163,1800,1800)
c=primary(ph,'Dallas Goedert','Johnny Mundt',ps,'PARTIAL_GAME');exposure(c,ps,0,1267)
ph['participationReviews']=[dict(player='Jalen Carter',finding='Reported wrist cast while playing. Normal active effectiveness assumption; no sourced lost interval or measured impairment percentage.',sourceIds=ps)]
receiver_review(ph,ps,'DeVonta Smith remains active; Stowers/Goedert absences do not remove the top two receiving values.')
healthy(ph,['Elijah Moore','Micah Morris'],ps)
for n in ['Tanner McKee','Cole Payton']:exclude(ph,n,'BACKUP_QB_NO_LOST_DUTY',ps,'Unused reserve quarterback; Hurts remained available.')
zeroes(te,['Andre James','Tanoh Kpassagnon','Jaren Kanak','Kendell Brooks'],ts)
for n in ['Milo Eifler','Jaylen Harrell']:case(te,n,ts,identity=supplemental(n))
impute_zero(te,'Dominique Hampton','LB',ts,'https://www.maddenratings.com/dominique-hampton')
impute_zero(te,'Dorian Mausi','LB',ts,'https://www.maddenratings.com/dorian-mausi')
primary(te,'Joshua Williams','Marcus Harris',ts)
primary(te,"Cor'Dale Flott",'Micah Robinson',ts,'OUT')
case(te,'James Williams Sr',ts,status='OUT')
healthy(te,['Atonio Mafi','Brandon Crenshaw-Dickson','Kylen Granson','Jackie Marshall'],ts)
cluster(te,'DEFENSIVE_BACK',ts,'Separate outside-corner vacancy and reserve-corner role assigned distinct active occupants; additive loss assumption.')
b['games'].append(dict(gameKey=k,away='PHI',home='TEN',state='READY',teams=[ph,te]))
k='2026-W02-LV-LAC'
vs=[source('lv-roster','https://www.raiders.com/team/players-roster/','Retained reserve inventory, including Collier, Runyon and Shorter.',k),source('lv-tx','https://www.raiders.com/team/transactions/2026','Older retained reserve Martin and dated roster changes reconciled.',k),source('lv-depth','https://www.raiders.com/team/depth-chart','Available active depth for TE, defensive front and secondary.',k),source('lv-final','https://www.raiders.com/news/las-vegas-raiders-week-2-inactives-vs-los-angeles-chargers-092026','Bowers and Porter injury scratches; remaining inactive identities reviewed.',k),source('lv-lac-post','https://www.reuters.com/sports/nfl/kirk-cousins-raiders-earn-road-win-over-mistake-prone-chargers--flm-2026-09-20/','Stukes concussion and Njoku right-knee exit on first play of Q2; 26–14 regulation result.',k,'REPORTING')]
ls=[source('lac-roster','https://www.chargers.com/team/players-roster/','Retained reserves including Lambert-Smith; pregame availability reconciled.',k),source('lac-tx','https://www.chargers.com/team/transactions/2026','Retained earlier reserve Jeremiah Wilson and dated transactions reviewed.',k),source('lac-depth','https://www.chargers.com/team/depth-chart','Slaughter starting center, Phillips linebacker, available safety and TE relief.',k),source('lac-final','https://www.chargers.com/news/raiders-inactives-ladd-mcconkey-fantasy-week-2','McConkey active; Molden/Pipkins/Leonard out. Other scratches separated.',k),source('lac-post','https://www.chargers.com/news/game-recap-raiders-week-2','Herbert completed reported game duties; Gadsden receiving role and Njoku injury.',k),'lv-lac-post']
lv=team('LV',vs);lc=team('LAC',ls)
zeroes(lv,["Dont'e Thornton Jr",'Chigozie Anusiem','Brennan Jackson'],vs)
case(lv,'Justin Shorter',vs,identity=supplemental('Justin Shorter'))
for n,pos,url,ovr in [('Chris Collier','RB','chris-collier',66),('Carter Runyon','TE','carter-runyon',59),('Brodric Martin','DT','brodric-martin',65)]:
 c=independent(lv,n,pos,[],vs,'https://www.maddenratings.com/'+url,ovr);c.update(resolution='ZERO_IMPUTED_BASELINE_ESTIMATE',assumptionRationale='Verified independent rating maps to zero on frozen curve; nonnegative replacement floor yields zero point loss, preserving independent-source provenance.')
camp(lv,['Justin Pickett','Corey Rucker'],vs)
primary(lv,'Keyron Crawford','Patrick Johnson',vs)
primary(lv,'Brock Bowers','Michael Mayer',vs,'OUT')
primary(lv,'Darien Porter','Hezekiah Masses',vs,'OUT')
c=primary(lv,'Treydan Stukes','Isaiah Pola-Mao',vs,'PARTIAL_GAME');exposure(c,vs,0,3600);c['exposure']['assumptionRationale']='Concussion exit is reported without game clock. Full zero-to-one-game duration range and midpoint estimate; not an exact departure time.'
healthy(lv,['Tristin McCollum','Dalton Johnson','Bryce Cabeldue','JJ Pegues'],vs)
exclude(lv,"Aidan O'Connell",'BACKUP_QB_NO_LOST_DUTY',vs,'Unused reserve quarterback; Cousins remained the game quarterback.')
cluster(lv,'DEFENSIVE_BACK',vs,'Distinct corner and safety vacancies assigned separate available players; additive interaction estimate.')
zeroes(lc,['Dalevon Campbell','Scott Matlock','Branson Taylor','Isaiah World','KeAndre Lambert-Smith','Trey Pipkins III','Deane Leonard'],ls)
primary(lc,'Denzel Perryman',"Del'Shawn Phillips",ls)
primary(lc,'Tyler Biadasz','Jake Slaughter',ls)
impute(lc,'Jeremiah Wilson','CB',['Cam Hart'],ls,'https://www.maddenratings.com/jeremiah-wilson')
primary(lc,'Elijah Molden','Tony Jefferson',ls,'OUT')
c=primary(lc,'David Njoku','Oronde Gadsden',ls,'PARTIAL_GAME');exposure(c,ls,900,960)
lc['participationReviews']=[dict(player='Derwin James Jr',finding='Finger injury with continued play; no independently established lost interval. Normal active effectiveness assumption, unquantified impairment uncertainty.',sourceIds=ls)]
healthy(lc,['Isas Waxter','Logan Taylor','Alex Harkey'],ls)
b['games'].append(dict(gameKey=k,away='LV',home='LAC',state='READY',teams=[lv,lc]))
k='2026-W02-SEA-ARI'
ss=[source('sea-roster','https://www.seahawks.com/team/players-roster/','Retained injured and PUP inventory.',k),source('sea-tx','https://www.seahawks.com/team/transactions/2026','Older retained Shemar Jean-Charles and game elevations reconciled.',k),source('sea-depth','https://www.seahawks.com/team/depth-chart/','Russell at FB, active Wilson/Holani backfield and distinct safety reserves.',k),source('sea-ari-final','https://www.seahawks.com/news/nick-emmanwori-active-for-seahawks-week-2-game-at-arizona','Both teams final inactive lists; Darnold, Okada, Bradford out; Emmanwori active.',k),source('sea-post','https://www.seahawks.com/news/seahawks-injury-updates-from-mike-macdonald-following-sunday-s-week-2-win-at-arizona','Price left Q4 with chest injury; Pili concussion; Holani cleared and returned. Emmanwori limited by planned return ramp.',k),source('sea-live','https://www.seahawks.com/news/2026-week-2-seahawks-at-cardinals-in-game-injury-updates','Pili ruled out before second half; Price reported chest injury.',k)]
asrc=[source('ari-roster','https://www.azcardinals.com/team/players-roster/','Conner/Carter return-designated reserves and Benson/Bisontis/Blount/Crawford/Geers/Proctor retained IR.',k),source('ari-tx','https://www.azcardinals.com/team/transactions/2026','Reiman PUP; earlier injury-settlement departures excluded.',k),source('ari-depth','https://www.azcardinals.com/team/depth-chart','Active backfield, OL and defensive back/linebacker relief.',k),source('ari-post','https://www.azcardinals.com/news/cardinals-can-t-find-way-to-dent-seahawks-in-loss','Melton toe and Will Johnson neck exits; Mack Wilson brief thumb absence with return. Brissett completed 31–7 regulation loss.',k),'sea-ari-final']
se=team('SEA',ss+['ari-post']);ar=team('ARI',asrc)
zeroes(se,['Jake Bobo'],ss)
for n in ['Brandon Pili','George Holani']:case(se,n,ss,status='PARTIAL_GAME')
case(se,'Mason Richman',ss,identity=supplemental('Mason Richman'))
c=independent(se,'Irvin Charles','WR',[],ss,'https://www.maddenratings.com/irvin-charles',64);c.update(resolution='ZERO_IMPUTED_BASELINE_ESTIMATE',assumptionRationale='Independent Madden 27 rating maps to zero; no fictional replacement needed for zero point loss. Official roster Irv Charles alias reconciled to Irvin Charles.')
for n,r in [('Zach Charbonnet','Emanuel Wilson'),('Robbie Ouzts','Brady Russell'),('Bud Clark','AJ Finley'),('Ty Okada','Rodney Thomas II'),('Anthony Bradford','Christian Haynes')]:primary(se,n,r,ss,'OUT' if n in ['Ty Okada','Anthony Bradford'] else 'IR')
impute(se,'Shemar Jean-Charles','CB',['Nehemiah Pritchett'],ss,'https://www.maddenratings.com/shemar-jean-charles')
c=primary(se,'Jadarian Price','George Holani',ss,'PARTIAL_GAME');exposure(c,ss+['ari-post'],2700,3600)
qb_loss(se,['Sam Darnold'],'Drew Lock',ss+['ari-post'])
se['participationReviews']=[dict(player='Nick Emmanwori',finding='Active, planned return ramp; coach said he could have played more. No additional injury loss inferred solely from reduced snaps.',sourceIds=ss)]
healthy(se,["Connor O'Toole",'Montorie Foster Jr','Mike Morris'],ss)
cluster(se,'DEFENSIVE_BACK',ss,'Distinct reserve safety/corner vacancies assigned separate available depth; additive interaction assumption.')
zeroes(ar,['Joey Blount','Kitan Crawford','Kaleb Proctor','Zach Carter','Tip Reiman'],asrc)
camp(ar,['Jameson Geers'],asrc)
for n,r in [('James Conner','Tyler Allgeier'),('Trey Benson','Jeremiyah Love'),('Chase Bisontis','Isaiah Adams'),('Garrett Williams','Denzel Burke')]:primary(ar,n,r,asrc,'OUT' if n=='Garrett Williams' else 'IR')
for n,r in [('Will Johnson',"Kei'Trel Clark"),('Max Melton','Kalen King')]:
 c=primary(ar,n,r,asrc,'PARTIAL_GAME');exposure(c,asrc,0,3600);c['exposure']['assumptionRationale']='Reported in-game exit without recovered clock; broad zero-to-full-game unavailable range, midpoint explicitly estimated.'
c=primary(ar,'Mack Wilson Sr','Cody Simon',asrc,'PARTIAL_GAME');exposure(c,asrc,0,0,0,300);c['exposure']['unavailableDurationEstimate']=dict(minimumSeconds=0,maximumSeconds=300,convention='BRIEF_REPORTED_RETURN_UP_TO_FIVE_MINUTES',sourceIds=asrc,rationale='Official recap explicitly says brief absence and return; five-minute upper bound is a disclosed modelling convention, not observed timing.');del c['exposure']['unavailableIntervals'];c['exposure']['assumptionRationale']='Use 0–5 minutes for a reported brief absence with return when no clock is recovered; midpoint 2.5 minutes, assumption sensitivity retained.'
cluster(ar,'DEFENSIVE_BACK',asrc,'Three distinct corner vacancies and available occupants, additive overlap assumption; partial-time uncertainty retained.')
healthy(ar,['Josh Fryar','Reggie Virgil','Andrew Billings'],asrc)
exclude(ar,'Carson Beck','BACKUP_QB_NO_LOST_DUTY',asrc,'Inactive backup; Brissett completed duties.')
b['games'].append(dict(gameKey=k,away='SEA',home='ARI',state='READY',teams=[se,ar]))
def brief(c,ss,duration=3600):
 exposure(c,ss,0,0,0,300,duration);del c['exposure']['unavailableIntervals'];c['exposure']['unavailableDurationEstimate']=dict(minimumSeconds=0,maximumSeconds=300,convention='BRIEF_REPORTED_RETURN_UP_TO_FIVE_MINUTES',sourceIds=ss,rationale='Reported brief injury absence with return; 0–5 minute interval is a model prior, not observed timing.');c['exposure']['assumptionRationale']='Disclosed brief-return duration prior, midpoint 2.5 minutes; uncertainty includes zero through five minutes.'
k='2026-W02-WAS-DAL'
ws=[source('was-roster','https://www.commanders.com/team/players-roster/','Retained IR/PUP and retired players reconciled.',k),source('was-tx','https://www.commanders.com/team/transactions/2026','Earlier Cracraft IR and dated moves; Jerome Ford no longer retained.',k),source('was-cuts','https://www.commanders.com/news/commanders-announce-multiple-roster-cuts-place-2-players-on-ir','Amos/McNichols IR and Wise PUP before opener.',k),source('was-depth','https://www.commanders.com/team/depth-chart','Game-available line, defensive front, receiver and backfield roles reconciled.',k),source('was-final','https://www.commanders.com/news/inactives-commanders-vs-cowboys-week-2-2026','Luvu and Okonkwo out; other scratches separated.',k),source('was-post','https://www.commanders.com/news/jayden-daniels-dan-quinn-commanders','Daniels elbow injury and Mariota relief; Cross internal injury, Coleman finger, Kinlaw shoulder and Cosmi concussion.',k),source('was-live','https://www.commanders.com/news/gameday-blog-commanders-vs-cowboys-week-2-2026','Daniels ruled out at halftime; Mariota played second half.',k),source('was-snaps','https://www.commanders.com/news/commanders-cowboys-stats-snaps-week-2-2026','Cosmi 68/71, Coleman 61/71, Wylie12, Cross55/55. Snap absence is an upper bound, not proof of injury cause.',k)]
ds=[source('dal-roster','https://www.dallascowboys.com/team/players-roster/','Retained IR includes Smith, Liufau, Moore, Davis, Fant, Hennessy, Gilliam and Rogers.',k),source('dal-depth','https://www.dallascowboys.com/team/depth-chart','Bass at LG, active secondary and linebacker relief.',k),source('dal-game','https://www.dallascowboys.com/news/updates-september-2026','Final inactives, Barham starting for Overshown, elevated Robinson/Barron; Durant/Locke injuries, brief Winters/Barham exits with returns.',k),'was-snaps']
wa=team('WAS',ws);da=team('DAL',ds)
zeroes(wa,['Jordan Magee'],ws)
case(wa,'Brandon Coleman',ws,status='PARTIAL_GAME')
impute_zero(wa,'River Cracraft','WR',ws,'https://www.maddenratings.com/river-cracraft')
for n,r in [('Trey Amos','Rasul Douglas'),('Jeremy McNichols','Kaytron Allen'),("Jer'Zhan Newton",'Shy Tuttle'),('Laremy Tunsil','Brandon Coleman'),('Deatrich Wise Jr','Charles Omenihu'),('Chigoziem Okonkwo','Ben Sinnott'),('Frankie Luvu','Leo Chenal')]:primary(wa,n,r,ws,'OUT' if n in ['Chigoziem Okonkwo','Frankie Luvu'] else 'IR')
c=primary(wa,'Sam Cosmi','Andrew Wylie',ws,'PARTIAL_GAME');exposure(c,ws,0,0,0,0);del c['exposure']['unavailableIntervals'];c['exposure']['unavailableSnapEstimate']=dict(playedSnaps=68,teamSnaps=71,injuryIndependentlyReported=True,healthyEverySnapRole=True,confoundingSubstitutionsAcknowledged=True,sourceIds=['was-post','was-snaps'],rationale='Independent concussion report with three nonplayed offensive snaps. Zero-to-three snaps bounds injury exposure; do not assert every substitution was injury-driven.');c['exposure']['assumptionRationale']='Missing snaps bound the loss for a normally every-snap OL role; midpoint of 0–3/71 is an explicit attribution estimate.'
qb_loss(wa,['Jayden Daniels'],'Marcus Mariota',ws,1800,1800,why='Official live report establishes injury exit at halftime and Mariota for second half; use exactly half-game time exposure, not a full-game loss.')
wa['participationReviews']=[dict(player='Nick Cross',finding='Internal injury reported after game, but played all 55 defensive snaps. No game-duty absence; normal active-effectiveness estimate.',sourceIds=ws),dict(player='Javon Kinlaw',finding='Shoulder issue reported; rotational snaps do not independently establish an injury-related lost interval. No percentage inferred from rotation.',sourceIds=ws)]
healthy(wa,['Luke McCaffrey','Isaac Yiadom','Ricky Barber','Tanoa Togiai'],ws)
exclude(wa,'Athan Kaliakmanis','BACKUP_QB_NO_LOST_DUTY',ws,'Emergency third QB; Mariota assumed starting duty after Daniels injury.')
exclude(wa,'Jerome Ford','RELEASED_BEFORE_GAME',ws,'Subsequent Minnesota practice-squad signing establishes departure from Washington; not retained as a Washington loss.')
cluster(wa,'OFFENSIVE_LINE',ws,'Tunsil full-game vacancy and Cosmi partial loss have separate occupants; Coleman has zero frozen value, no extra injury loss.')
zeroes(da,['Marist Liufau','Devin Moore','Princeton Fant'],ds);case(da,'Matt Hennessy',ds,identity=supplemental('Matt Hennessy'))
camp(da,['Kelvin Gilliam','DJ Rogers'],ds)
for n,r in [('Tyler Smith','T.J. Bass'),('Malik Davis','Emari Demercado'),('DeMarvion Overshown','Jaishawn Barham'),('Malik Hooker','P.J. Locke')]:primary(da,n,r,ds,'OUT' if n in ['DeMarvion Overshown','Malik Hooker'] else 'IR')
for n,r in [('Jaishawn Barham','Shemar James'),('Dee Winters','Curtis Robinson')]:
 c=primary(da,n,r,ds,'PARTIAL_GAME');brief(c,ds)
c=primary(da,'P.J. Locke','Markquese Bell',ds,'PARTIAL_GAME');c.update(resolution='PARTIAL_VALUE_INVARIANT',activeEffectivenessConvention='NO_UNREPORTED_IMPAIRMENT')
c=primary(da,'Cobie Durant','Shavon Revel Jr',ds,'PARTIAL_GAME');exposure(c,ds,0,3600);c['exposure']['assumptionRationale']='Reported hamstring exit with no recovered clock; broad zero-to-full-game unavailable range, midpoint explicitly estimated.'
healthy(da,['Caelen Carson','James Houston IV','Ajani Cornelius','Camden Brown','Tyler Goodson'],ds)
cluster(da,'LINEBACKER',ds,'Overshown duty initially filled by Barham; separate small correction for Barham injury values relief below Barham, without valuing a second healthy starting position. Winters distinct duty. Additive estimate.')
cluster(da,'DEFENSIVE_BACK',ds,'Hooker and Durant distinct full/partial vacancies; Locke equal-valued secondary relief has invariant zero incremental loss.')
b['games'].append(dict(gameKey=k,away='WAS',home='DAL',state='READY',teams=[wa,da]))
k='2026-W02-MIA-SF'
ms=[source('mia-roster','https://www.miamidolphins.com/team/players-roster/','Retained reserves including Cole Turner.',k),source('mia-tx','https://www.miamidolphins.com/team/transactions/2026','Baker/Duck PUP, Grant/Moore/Salyer/Gonzalez IR; Ferrell/Llewellyn elevated, Ojabo released.',k),source('mia-depth','https://www.miamidolphins.com/team/depth-chart','Available professional specialists and active depth; Sep22 Andre Jones addition excluded retrospectively.',k),source('mia-final','https://www.thephinsider.com/miami-dolphins-injuries/122784/dolphins-vs-49ers-inactive-list-injuries-hit-starters','Chop Robinson injury inactive; Addington active; remaining scratches separated.',k,'REPORTING'),source('mia-post','https://www.miamidolphins.com/news/game-recap-dolphins-lose-week-2-matchup-to-49ers','Willis completed reported game duties; 35–13 regulation loss.',k)]
fs=[source('sf-roster','https://www.49ers.com/team/players-roster/','Full retained reserve inventory including line reserves and Mykel Williams/Guerendo PUP.',k),source('sf-tx','https://www.49ers.com/team/transactions/2026','Earlier retained reserves and active relief moves reconciled.',k),source('sf-cuts','https://www.49ers.com/news/49ers-announce-moves-for-initial-53-man-roster-x1231','Kirk, Pleasants, Toth and Zakelj IR; Guerendo/Williams PUP.',k),source('sf-depth','https://www.49ers.com/team/depth-chart','Available replacement role groups; inactive Watkins/Prysock not used.',k),source('sf-final','https://www.49ers.com/news/eddy-pineiro-kaelon-black-available-vs-dolphins-inactives-for-week-2-miavssf','Black and Pineiro active, Stribling IR; final inactive list.',k),source('sf-post','https://www.49ers.com/news/49ers-defeat-dolphins-35-13-in-home-opener-takeaways-from-miavssf','Purdy completed reported duties in regulation win.',k),source('sf-injuries','https://www.49ers.com/news/shanahan-on-49ers-win-over-dolphins-provides-new-injury-updates','Height broken hand, Thompson/Robinson ankle sprains; Evans hip managed after game.',k)]
mi=team('MIA',ms);sf=team('SF',fs)
zeroes(mi,['Ronnie Harrison Jr','Kyle Louis','Storm Duck','Jamaree Salyer'],ms)
camp(mi,['Rene Konga'],ms);impute_zero(mi,'Cole Turner','TE',ms,'https://www.maddenratings.com/cole-turner')
for n,r in [('Darrell Baker Jr','Reese Taylor'),('Kenneth Grant','Keith Cooper Jr'),('Trey Moore','Max Llewellyn'),('Chop Robinson','Clelin Ferrell')]:primary(mi,n,r,ms,'OUT' if n=='Chop Robinson' else 'IR')
mi['specialistCases']=[dict(player='Zane Gonzalez',position='K',replacementPlayer='Riley Patterson',method='NEUTRAL_SPECIALIST_REPLACEMENT_ESTIMATE',estimateAcknowledged=True,availableProfessionalReplacement=True,materialRoleDisruption=False,rationale='Established professional replacement kicker available; neutral specialist difference estimate with unquantified uncertainty.',sourceIds=ms,replacementSourceIds=ms)]
mi['participationReviews']=[dict(player='Tucker Addington',finding='Questionable shoulder but active; no reported material snapping interruption in reviewed recap. Normal active assumption; later practice-squad insurance does not establish prior-game loss.',sourceIds=ms)]
healthy(mi,['Jalen Tolbert','Marcellas Dial Jr','DJ Campbell','Chukwuebuka Godrick','Justin Joly'],ms)
exclude(mi,'Brady Cook','BACKUP_QB_NO_LOST_DUTY',ms,'Inactive backup; Willis remained game quarterback.')
exclude(mi,'David Ojabo','RELEASED_BEFORE_GAME',ms,'Released at final cuts; removed from earlier replacement pool.')
zeroes(sf,['Sam Okuayinonu','Nick Martin','Victor Dimukeje','Darrick Forrest','Austen Pleasants','Brett Toth'],fs)
camp(sf,['Mikail Kamara'],fs)
impute_zero(sf,'Nick Zakelj','C',fs,'https://www.maddenratings.com/nick-zakelj')
impute(sf,'Andrew Farmer II','EDGE',['Khalid Kareem'],fs,'https://www.maddenratings.com/andrew-farmer-ii')
impute(sf,'Patrick Taylor Jr','RB',['Jordan James'],fs,'https://www.maddenratings.com/patrick-taylor-jr')
for n,r in [('Jake Tonges','Brayden Willis'),('Alfred Collins','C.J. West'),('Nate Hobbs','Upton Stout'),('Ricky Pearsall','Deebo Samuel Sr'),("De'Zhaun Stribling",'Jacob Cowing'),('Christian Kirk','KhaDarel Hodge'),('Isaac Guerendo','Kaelon Black'),('Mykel Williams','Keion White')]:primary(sf,n,r,fs)
c=primary(sf,'Romello Height','Ogbo Okoronkwo',fs,'PARTIAL_GAME');c.update(resolution='PARTIAL_VALUE_INVARIANT',activeEffectivenessConvention='NO_UNREPORTED_IMPAIRMENT')
case(sf,'James Thompson Jr',fs,status='PARTIAL_GAME')
c=primary(sf,'Demarcus Robinson','Mike Evans',fs,'PARTIAL_GAME');exposure(c,fs,0,3600);c['assumptionRationale']='Additional receiving duties among available Evans/Kittle/Deebo group can be supported without reducing healthy baseline. Evans assigned only this vacancy; his higher frozen value floors partial loss at zero, not a claimed improvement.'
sf['participationReviews']=[dict(player='Mike Evans',finding='Postgame hip management reported; no confirmed missed interval from this issue in game coverage. Normal active effectiveness assumption, impairment uncertainty unquantified.',sourceIds=fs)]
healthy(sf,['Ephesians Prysock','Jordan Watkins','Tatum Bethune','Enrique Cruz Jr'],fs)
exclude(sf,'Kurtis Rourke','BACKUP_QB_NO_LOST_DUTY',fs,'Inactive reserve QB; Purdy completed reported duties.')
receiver_review(sf,fs,'Kittle and Evans, the two highest-valued healthy receiving options, remain available. Multiple lower-value receiver absences do not alone qualify for the top-two multiplier.')
b['games'].append(dict(gameKey=k,away='MIA',home='SF',state='READY',teams=[mi,sf]))
k='2026-W02-IND-KC'
isrc=[source('ind-roster','https://www.colts.com/team/players-roster/','Retained injured inventory and game-available depth.',k),source('ind-tx','https://www.colts.com/team/transactions/2026','McKeon/Owen/Mitchell/Towt IR; Gould game elevation. Slayton signed after game, not used retrospectively.',k),source('ind-depth','https://www.colts.com/team/depth-chart','Treadwell behind Pierce; available receivers and other role groups.',k),source('ind-final','https://www.colts.com/news/colts-announce-6-inactive-players-for-week-2-game-vs-kansas-city-chiefs','Dulin and Giddens injury inactive; Gould elevated.',k),source('ind-pierce','https://www.colts.com/news/x-rays-on-left-heel-negative-for-wr-alec-pierce','Pierce Q1 heel injury, no return.',k),source('ind-post','https://www.colts.com/news/colts-drop-heartbreaker-in-week-2-overtime-loss-to-kansas-city-chiefs','Final kick as ten-minute overtime expired; 4200-second total. Jones completed reported duties.',k)]
ks=[source('kc-roster','https://www.chiefs.com/team/players-roster/','Retained injured/PUP inventory.',k),source('kc-tx','https://www.chiefs.com/team/transactions/2026','Holiday IR; Hanson/Oladokun/EJ Smith settled and excluded.',k),source('kc-depth','https://www.chiefs.com/team/depth-chart','Benson tackle and Hicks safety replacements.',k),source('kc-final','https://www.chiefs.com/news/week-2-inactive-players-colts-vs-chiefs','Conner/Simmons unavailable; remaining scratches reviewed.',k),source('kc-post','https://www.chiefs.com/news/chiefs-defeat-colts-33-30-in-overtime-thriller-on-sunday-night-football','Official recap explicitly reports clean injury bill; Mahomes completed reported duties.',k),'ind-post']
inteam=team('IND',isrc);kc=team('KC',ks)
zeroes(inteam,['Will Mallory','D.J. Montgomery'],isrc)
case(inteam,'DJ Giddens',isrc,status='OUT');case(inteam,'Micheal Clemons',isrc,status='PARTIAL_GAME')
for n,pos,url in [('Coleman Owen','WR','coleman-owen'),('Sean McKeon','TE','sean-mckeon')]:impute_zero(inteam,n,pos,isrc,'https://www.maddenratings.com/'+url)
c=independent(inteam,'Cameron Mitchell','CB',[],isrc,'https://www.maddenratings.com/cameron-mitchell',71);c.update(resolution='ZERO_IMPUTED_BASELINE_ESTIMATE',assumptionRationale='Verified independent overall 71 maps to zero through frozen curve; nonnegative replacement floor yields zero point loss.')
camp(inteam,['Carson Towt','Jack Wilson'],isrc)
primary(inteam,'Ashton Dulin','Anthony Gould',isrc,'OUT')
c=primary(inteam,'Alec Pierce','Laquon Treadwell',isrc,'PARTIAL_GAME');exposure(c,isrc,0,900,4200,4200,4200)
healthy(inteam,['George Gumbs Jr','Austin Ajiake','Dalton Tucker'],isrc)
exclude(inteam,'Riley Leonard','BACKUP_QB_NO_LOST_DUTY',isrc,'Emergency third QB; Jones completed duties.')
receiver_review(inteam,isrc,'Tyler Warren, the highest-valued receiving option, remains available; Dulin/Pierce do not remove top-two receiving values.')
zeroes(kc,['Cooper McDonald','Omarr Norman-Lott','Ethan Downs','John Michael Gyllenborg'],ks)
impute_zero(kc,'Jimmy Holiday','WR',ks,'https://www.maddenratings.com/jimmy-holiday')
camp(kc,['Jeff Caldwell'],ks)
primary(kc,'Josh Simmons','Kahlil Benson',ks,'OUT');primary(kc,'Chamarri Conner','Jaden Hicks',ks,'OUT')
healthy(kc,['Jared Wiley','Jack Pyburn','Diego Pounds','Bryson Eason'],ks)
exclude(kc,'Garrett Nussmeier','BACKUP_QB_NO_LOST_DUTY',ks,'Emergency third QB; Mahomes completed game duties.')
b['games'].append(dict(gameKey=k,away='IND',home='KC',state='READY',teams=[inteam,kc]))
k='2026-W02-NYG-LAR'
ns=[source('nyg-roster','https://www.giants.com/team/players-roster/','Retained injured inventory including Bernard-Converse and Robertson-Harris.',k),source('nyg-tx','https://www.giants.com/team/transactions/2026','Adebo IR; Berrios/Harrison elevated; Slayton released before game; active Tupou.',k),source('nyg-depth','https://www.giants.com/team/depth-chart','Active role group alternatives after removing final scratches.',k),source('nyg-post','https://www.giants.com/news/instant-analysis-giants-fall-to-rams-28-6','Dart seventh-play injury; Nabers Q1 0:01 exit and Q2 return; Thomas late exit; Burns exited at Q4 6:04. Hood started for Banks.',k),source('nyg-injury','https://www.giants.com/news/jaxson-dart-knee-injury-update-status-jameis-winston','Confirmed Dart, Burns, Thomas injuries and Nabers return.',k),source('nyg-lar-final','https://www.therams.com/news/puka-nacua-among-rams-inactives-for-monday-night-football-vs-giants-week-2-2026','Both teams final inactives: Banks/McFadden; Rams Nacua/Whittington/Kinchens.',k)]
ls=[source('lar-roster','https://www.therams.com/team/players-roster/','Retained injured inventory including Thomas, Walls and Garrett.',k),source('lar-tx','https://www.therams.com/team/transactions/2026','Garrett IR; Ingle signed, Neal elevated; Chad Lindberg settlement; no Andersen elevation.',k),source('lar-depth','https://www.therams.com/team/depth-chart','Stewart edge, Atwell/Smith receivers and McCollough safety. Donald interior role distinct from Garrett edge vacancy.',k),source('lar-post','https://www.therams.com/news/game-recap-rams-defeat-giants-28-6-on-monday-night-football','Stafford completed 28–6 regulation win; Nabers targeted again by Q2 6:11.',k),'nyg-lar-final']
ng=team('NYG',ns+['lar-post']);la=team('LAR',ls)
zeroes(ng,['Korie Black','Gunner Olszewski'],ns)
c=independent(ng,'Jarrick Bernard-Converse','CB',[],ns,'https://www.maddenratings.com/jarrick-bernard-converse',66);c.update(resolution='ZERO_IMPUTED_BASELINE_ESTIMATE',assumptionRationale='Verified independent rating maps to zero under frozen curve; preserve source provenance without fictional substitute.')
camp(ng,['Thaddeus Dixon','Dante Miller','DJ James'],ns)
primary(ng,'Paulson Adebo','Greg Newsome II',ns)
primary(ng,'Calvin Austin','Braxton Berrios',ns)
primary(ng,'Roy Robertson-Harris','Josh Tupou',ns)
primary(ng,'Deonte Banks','Colton Hood',ns,'OUT')
primary(ng,'Micah McFadden','Malik Harrison',ns,'OUT')
c=primary(ng,'Andrew Thomas','Marcus Mbow',ns,'PARTIAL_GAME');exposure(c,ns+['lar-post'],2700,3600)
c=primary(ng,'Brian Burns','Kayvon Thibodeaux',ns,'PARTIAL_GAME');exposure(c,ns+['lar-post'],3236,3236)
c=primary(ng,'Malik Nabers','Malachi Fields',ns,'PARTIAL_GAME');exposure(c,ns+['lar-post'],899,899,900,1429);c['exposure']['assumptionRationale']='Exit at Q1 0:01. Return sometime in Q2, with target by Q2 6:11; unknown earlier return bounded rather than treating target as exact return clock.'
qb_loss(ng,['Jaxson Dart'],'Jameis Winston',ns+['lar-post'],0,900,why='Seventh-play injury on opening drive in Q1; quarter-bound midpoint until game end, not a full-game absence or an exact injury clock.')
healthy(ng,['Thomas Fidone II','J.C. Davis','Bobby Jamison-Travis','Darius Alexander','Jason Pinnock'],ns)
exclude(ng,'Darius Slayton','RELEASED_BEFORE_GAME',ns,'Released September 7; no longer part of Giants game-day injury baseline.')
receiver_review(ng,ns,'Calvin Austin and brief Nabers absence do not remove the two highest-valued expected receiving options while Mooney/Likely remain available.')
zeroes(la,['Justin Dedich','Keagen Trost'],ls)
c=independent(la,'Keir Thomas','EDGE',[],ls,'https://www.maddenratings.com/keir-thomas',62);c.update(resolution='ZERO_IMPUTED_BASELINE_ESTIMATE',assumptionRationale='Verified independent overall62 maps to zero through frozen curve; source distinction retained.')
camp(la,['Eddie Walls III'],ls)
exclude(la,'Chad Lindberg','RELEASED_BEFORE_GAME',ls,'June17 injury settlement; not a retained reserve absence.')
exclude(la,'Matthew Caldwell','BACKUP_QB_NO_LOST_DUTY',ls,'Developmental reserve quarterback not established starting baseline; Stafford available.')
for n,r in [('Myles Garrett','Josaiah Stewart'),('Puka Nacua','Tutu Atwell'),('Jordan Whittington','Xavier Smith'),('Kamren Kinchens','Jaylen McCollough')]:primary(la,n,r,ls,'IR' if n=='Myles Garrett' else 'OUT')
healthy(la,['CJ Daniels Jr','Bill Murray'],ls)
exclude(la,'Ty Simpson','BACKUP_QB_NO_LOST_DUTY',ls,'Emergency third QB; Stafford completed duties.')
receiver_review(la,ls,'Davante Adams remains available; Nacua/Whittington do not remove both of the two highest-valued expected receivers.')
b['games'].append(dict(gameKey=k,away='NYG',home='LAR',state='READY',teams=[ng,la]))
# Final interaction review after all separately sourced vacancies are assembled.
cluster(se,'RUNNING_BACK',ss,'Charbonnet full and Price partial backfield vacancies use Wilson and Holani separately; Ouzts fullback duties use Russell. Additive estimate with no extra group multiplier.')
k='2026-W02-DET-BUF'
detss=det['sourceIds']
sid=source('det-maddox-exit','https://www.detroitlions.com/news/recap-lions-at-bills-goff-gibbs-stbrown','Maddox exited early Q2 and did not return; September22 IR followed game.',k)
detss.append(sid)
c=primary(det,'Avonte Maddox','Christian Izien',detss,'PARTIAL_GAME');c.update(resolution='PARTIAL_VALUE_INVARIANT',activeEffectivenessConvention='NO_UNREPORTED_IMPAIRMENT');c['assumptionRationale']='Available safety Izien supplies incremental Maddox relief at the same .2 frozen value; Joseph vacancy already uses Maddox .2, so this secondary relief has zero incremental loss at any exposure.'
sid=source('buf-roster','https://www.buffalobills.com/team/players-roster/','Dorian Strong retained NFI roster identity, separate from available cornerbacks.',k)
bs=buf['sourceIds']+[sid]
independent(buf,'Dorian Strong','CB',['Davison Igbinosun'],bs,'https://www.maddenratings.com/dorian-strong',72)
out=base/'2026-09-22-full-slate-approved-estimates.json';out.write_text(json.dumps(b,indent=2)+'\n');subprocess.run(['git','hash-object','-w',str(out)],cwd=root,check=True,stdout=subprocess.DEVNULL)
print(out)
