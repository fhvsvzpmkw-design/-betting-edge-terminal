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
c=primary(mi,'Blake Cashman','Ivan Pace Jr',ms,'PARTIAL_GAME');exposure(c,ms,1800,2700);c['exposure']['assumptionRationale']='Brief absence on opening Q3 drive; exact return clock not recovered. Explicit broad zero-to-one-quarter unavailable-duration bound, midpoint 450 seconds; normal effectiveness on return assumed.'
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
out=base/'2026-09-22-full-slate-approved-estimates.json';out.write_text(json.dumps(b,indent=2)+'\n');subprocess.run(['git','hash-object','-w',str(out)],cwd=root,check=True,stdout=subprocess.DEVNULL)
print(out)
